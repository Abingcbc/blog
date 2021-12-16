---
title: "[BugFix] Kubernetes Ingress Nginx DNS 报错日志 Bug Fix"
date: 2021-03-13 12:27:49
categories:
- BugFix
tags:
- Kubernetes
---
## 问题
目前，当指定访问集群外部地址为 IP 时，ingress-nginx controller 的日志中存在大量的 DNS 报错的垃圾日志。虽然不影响正常运行（猜测可能会导致性能波动，对比见最后），但是查看 Nginx 日志 debug 时效率严重降低。

<!-- more -->

![](/asset/ingress-nginx-bug-fix/error.png)

## 原因
详细的讨论见：
[https://github.com/coredns/coredns/issues/2324](https://github.com/coredns/coredns/issues/2324)

简略总结下，导致访问外部 IP，Nginx 报 DNS 解析错误的原因在于 Kubernetes 自身的bug，缺少了一个验证。

出现问题的情况是通过 ExternalName 类型的 Service 访问外部服务的。定义的 yaml 类似于下面这种：
```yaml
kind: Service
apiVersion: v1
metadata:
  name: demo2
  namespace: default
spec:
  type: ExternalName
  externalName: xxx.xxx.xxx.xxx
```
对于 Kubernetes 的设计来说，ExternalName 就是一个域名。K8s 官方是这样介绍的 

> ExternalName: Maps the service to the contents of the externalName field (e.g. foo.bar.example.com), by returning aCNAMErecord with its value. No proxying of any kind is set up.

> Note:ExternalName accepts an IPv4 address string, but as a DNS names comprised of digits, not as an IP address. ExternalNames that resemble IPv4 addresses are not resolved by CoreDNS or ingress-nginx because ExternalName is intended to specify a canonical DNS name.

从实现上来看，ExternalName 类型的 Service 其实就是在 CoreDNS 里的一条 CNAME 记录。 CNAME 是一条域名指向另一个域名的记录，在 K8s 中，这条 record 记载的就是 Service 名字指向 ExtenalName 的一个映射。

但是，当 ExternalName 类型的 Service 中设定的是 IP 时，K8s 并没有对其进行判断，仍然允许其正常创建。

同时，Nginx 本身存在着一个轮询机制，会不断的向 DNS 服务拉取记录进行缓存。
[https://github.com/kubernetes/ingress-nginx/blob/master/rootfs/etc/nginx/lua/util/dns.lua](https://github.com/kubernetes/ingress-nginx/blob/master/rootfs/etc/nginx/lua/util/dns.lua)

在每次拉取缓存时会发生以下的过程：
1. Nginx 从 CoreDNS 拉取到了一个 CNAME 记录，例如：demo2 -> xxx.xxx.xxx.xxx
2. 接着，Nginx 尝试解析 xxx.xxx.xxx.xxx 这个域名，CoreDNS 自然是对这个长成 IP 样子的域名解析不出来的，于是解析失败，导致报错

------

至于为什么 DNS 解析失败之后，Nginx 仍然能够成功转发请求，原因是 ingress-nginx controller 在实现上并没有对这个进行区分。

首先，先简单介绍下 controller 的原理。Ingress-nginx controller 一直监听着 k8s 系统中的 ingress 资源。当有新的 ingress 创建时，controller 会开始更新 Nginx 的配置文件，向其中添加转发规则，并重启 Nginx。

下面是 controller 解析指向 ExternalName 的 ingress，然后创建 upstream 的逻辑
[https://github.com/kubernetes/ingress-nginx/blob/5f1a37a624ca38e8cccc87cb7a36d7dbcbe70b01/internal/ingress/controller/endpoints.go#L52](https://github.com/kubernetes/ingress-nginx/blob/5f1a37a624ca38e8cccc87cb7a36d7dbcbe70b01/internal/ingress/controller/endpoints.go#L52)

![](/asset/ingress-nginx-bug-fix/nginx-code.png)

可以看到，controller 是没有强制解析 ExternalName 成域名的，所以写进 nginx.conf 的 upstream 也是 ip 形式，这样 nginx 会自然地将 ExternalName 解析成 IP，从而可以正常工作。

## 解决方法
在上面提到的 Github Issue 的讨论中，有大佬已经给出了解决方法，就是通过 Service without selectors 的方式。
https://kubernetes.io/docs/concepts/services-networking/service/#services-without-selectors

常见的 K8s Service 都是通过标签选择器，选择一系列 Pod 作为后端，K8s endpoint controller 会自动根据 Service 的声明去为 Service 的每个端口创建一个 endpoint。Endpoint 是 K8s 中实际进行服务路由的资源。

而创建 Service without selectors，就需要我们手动去创建一个与 Service 同名的 endpoint。这样就不需要指定 Service 为 ExternalName 的类型，CoreDNS 中就会将其视作一条 A 记录，而不是一条 CNAME 记录。Nginx 拉取 DNS 缓存时也不会把 IP 当做域名了。
```yaml
apiVersion: v1
kind: Service
metadata:
  name: demo2
  namespace: default
spec:
  clusterIP: None
  ports:
  - name: grpc
    port: 32443
    protocol: TCP
---
kind: Endpoints
apiVersion: v1
metadata:
  name: demo2
  namespace: default
subsets:
  - addresses:
      - ip: xxx.xxx.xxx.xxx
    ports:
      - port: 32443
        name: grpc
        protocol: TCP
```

## 对比
在两个对等的集群发生通信时，demo1 修复，demo2不修复，对比两侧的 CPU 使用情况

demo1：
![](/asset/ingress-nginx-bug-fix/demo1.png)

demo2：
![](/asset/ingress-nginx-bug-fix/demo2.png)

demo2 大约比 demo1 消耗 CPU 多 0.020 个核。虽然这个报错会稍微增加一点 CPU 的使用量，但并不多。
