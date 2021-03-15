---
title: "[Tutorial] Kubernetes Ramp Up"
date: 2021-03-15 15:39:36
categories:
- Cloud
tags:
- Kubernetes
---
## 目标
- 介绍 K8s，Docker 概念以及原理
- 从 0 开始部署一个简单完整的服务

## Docker是什么？
Docker是由Google推出的Go语言进行开发实现，基于Linux内核的 <font color=red>namespace</font>，对<font color=red>进程</font>进行封装<font color=red>隔离</font>，属于操作系统层面的容器化技术。

![](/asset/k8s-ramp-up/1.png)

### 三大核心概念
镜像（Image）

容器（Container）

仓库（Repository）

从代码的角度来看，镜像就像一个类；容器是对象实例，运行时在系统中会有许多容器；仓库主要用于存储和维护这些镜像。

### 为什么使用 Docker？
- 配置环境
开发过程中一个常见的问题是环境一致性问题。由于开发环境、测试环境、生产环境不一致，导致有些 bug 并未在开发过程中被发现。而 Docker 的镜像提供了除内核外完整的运行时环境，确保了应用运行环境一致性
- 应用隔离
机器上可能同时运行多个服务。如果服务之间没有隔离，一个服务出现异常，往往可能会导致其他服务也挂掉。同时，不同服务所依赖的环境也可能发生冲突。

### 原理
首先，要了解一下进程的命名空间。Linux 系统中的所有进程按照惯例是通过PID标识的，这意味着内核必须管理一个全局的PID列表。而且，所有调用者通过uname系统调用返回的系统相关信息（包括系统名称和有关内核的一些信息）都是相同的。

Linux 的命名空间从内核层面上进行了虚拟化，对所有的全局资源进行一个抽象。本质上，建立了系统的不同视图。每一项全局资源都必须包装到命名空间的数据结构中，只有资源和包含资源的命名空间构成的二元组仍然是全局唯一的。不仅仅是 PID，Linux 通过同样的方法对其他资源也做了虚拟化处理。命名空间共有以下6种：

![](/asset/k8s-ramp-up/2.png)

借助 Linux 的命名空间，Docker 对进程进行隔离，可以从进程树的角度理解。

![](/asset/k8s-ramp-up/3.png)

每次在执行 `docker start` 或 `docker run` 的时候，其实是由 docker 的 daemon 进程 docker containerd，调用 Linux 系统调用 `clone()` 去创建新的进程。而创建进程的过程中就为新创建的进程分配了新的 Linux 命名空间。可以简单阅读一下 docker 的开源代码

```go
// https://github.com/moby/moby/blob/49e809fbfe250f3df2deacc0c3e5c403db3b8915/daemon/start.go#L17
// 创建容器的函数，其中又调用了设置
func (daemon *Daemon) ContainerStart(name string, hostConfig *containertypes.HostConfig, checkpoint string, checkpointDir string) error

// https://github.com/moby/moby/blob/470ae8422fc6f1845288eb7572253b08f1e6edf8/daemon/oci_linux.go#L212
// 设置 Namespace
func setNamespace(s *specs.Spec, ns specs.LinuxNamespace) {
   for i, n := range s.Linux.Namespaces {
      if n.Type == ns.Type {
         s.Linux.Namespaces[i] = ns
         return
      }
   }
   s.Linux.Namespaces = append(s.Linux.Namespaces, ns)
}

// https://github.com/moby/moby/blob/49e809fbfe250f3df2deacc0c3e5c403db3b8915/daemon/start.go#L198
// 创建新的进程
pid, err := daemon.containerd.Start(context.Background(), 
                                    container.ID, 
                                    checkpointDir,    
                                    container.StreamConfig.Stdin() != nil | | container.Config.Tty, 
                                    container.InitializeStdio)
```

### 如何安装？
[https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/)

## Kubernetes是什么？
Kubernetes 是 Google 于 2014 年基于其内部 Brog 系统开源的一个容器编排管理系统，可使用声明式的配置（以 yaml 文件的形式）自动地执行容器化应用程序的管理，包括部署、伸缩、负载均衡、回滚等。

为什么叫 K8s？因为 K<font color=red>ubernete</font>s，中间是8个字母。

kubernetes 提供的功能：
- 自动发布与伸缩：可以通过声明式的配置文件定义想要部署的容器
- 滚动升级与灰度发布：采用逐步替换的策略实现滚动升级
- 服务发现与负载均衡：Kubernetes 通过 DNS 名称或 IP 地址暴露容器的访问方式，并且可在同一容器组内实现负载分发与均衡
- 存储编排：Kubernetes 可以自动挂载指定的存储系统，如 local storage/nfs / 云存储等
- 故障恢复：Kubernetes 自动重启已经停机的容器，替换不满足健康检查的容器
- 密钥与配置管理：Kubernetes 可以存储与管理敏感信息，如 Docker Registry 的登录凭证，密码，ssh 密钥等

### 为什么使用 K8s？
大型单体应用被逐渐拆分成小的、可独立运行的组件。随着部署组件的增多和数据中心的增长，配置、管理和运维变得很困难。(微服务）

K8s 的定义就是容器编排和管理引擎，解决了这些问题。

### 如何安装？
由难到易(๑•̀ㅂ•́)و✧
- Kubeadm: https://kubernetes.io/docs/reference/setup-tools/kubeadm/
- MiniKube: Local kubernetes https://minikube.sigs.k8s.io/docs/start/
- Kind: Kubernetes in Docker https://github.com/kubernetes-sigs/kind
- Docker-desktop（仅限 Mac）: 一键开启
![](/asset/k8s-ramp-up/4.png)


其他版本的类 K8s 系统：
- K3s: https://github.com/k3s-io/k3s
- K0s: https://github.com/k0sproject/k0s

## Kubernetes 架构

![](/asset/k8s-ramp-up/5.png)

### master

Master 负责管理服务来对整个系统进行管理与控制，包括
- apiserver：作为整个系统的对外接口，提供一套 Restful API 供客户端调用，任何的资源请求 / 调用操作都是通过 kube-apiserver 提供的接口进行, 如 kubectl、kubernetes dashboard 等管理工具就是通过 apiserver 来实现对集群的管理
- kube-scheduler：资源调度器，负责将容器组分配到哪些节点上
- kube-controller-manager：管理控制器，集群中处理常规任务的后台线程，包括节点控制器（负责监听节点停机的事件并作出对应响应）、endpoint-controller（刷新服务与容器组的关联信息）、replication-controller（维护容器组的副本数为指定的数值）、Service Account & Token 控制器（负责为新的命名空间创建默认的 Service Account 以及 API Access Token）
- etcd：数据存储，存储集群所有的配置信息
- coredns：实现集群内部通过服务名称进行容器组访问的功能

### worker

Worker 负载执行 Master 分配的任务，包括
- kubelet：是工作节点上执行操作的代理程序，负责容器的生命周期管理，定期执行容器健康检查，并上报容器的运行状态
- kube-proxy：是一个具有负载均衡能力的简单的网络访问代理，负责将访问某个服务的请求分配到工作节点的具体某个容器上（kube-proxy 也运行于 master node 上）
- Docker Daemon：Kubernetes 其实不局限于 Docker（即将取消），它支持任何实现了 Kubernetes 容器引擎接口的容器引擎，如 containerd、rktlet

### 网络通信
网络通信组件只需要符合 CNI （Container Network Interface）接口规范，主要作用在于给各个容器分配集群内 IP，使得其内网 IP 能够集群内唯一，并且可以互相访问，目前常用的有 Flannel，Calico等网络组件。

简单介绍下比较常用的 Flannel 的原理。Flannel 运行在第3层网络层，基于 IPv4，创建一个大型内部网络，跨越集群中每个节点。每个节点组成一个子网，每个容器在内网中有唯一的IP。

首先，Flannel 会为每台节点分配一个子网段。Flanneld 在 Docker 容器启动时修改其启动参数，将其 IP 限制在当前的子网段内，具体 IP 的分配仍是由 docker 进行。Flannel通过Etcd服务维护了一张节点间的路由表，详细记录了各节点子网网段，保证不同节点的子网网段不会重复。

数据从源容器中发出后，经由所在主机的docker0虚拟网卡转发到flannel0虚拟网卡，flanneld服务监听在网卡的另外一端。

源主机的flanneld服务将原本的数据内容UDP封装后根据自己的路由表投递给目的节点的flanneld服务，数据到达以后被解包，然后直接进入目的节点的flannel0虚拟网卡，然后被转发到目的主机的docker0虚拟网卡，最后就像本机容器通信一下的有docker0路由到达目标容器。

![](/asset/k8s-ramp-up/6.png)

## 快速上手 K8s 概念

一些推荐的 K8s 概念介绍：
- 微软的 50天 K8s 教程中（https://azure.microsoft.com/en-us/resources/kubernetes-learning-path/）通过动物园的形式介绍了一些 K8s 概念 http://aka.ms/k8s/LearnwithPhippy
- 综述PPT：https://www2.slideshare.net/BobKillen/kubernetes-a-comprehensive-overview-updated?from_action=save

K8s 中的概念极多，比较零碎，这里通过一个简单的小例子，尽可能覆盖多的 K8s 概念。

## 概览

例子使用一个开源的 fortune-teller 镜像（`quay.io/kubernetes-ingress-controller/grpc-fortune-teller:0.1`） ，每次请求容器内的服务，服务会返回一句名言。希望在 MacOS 的环境下，展示一个应用在 K8s 中运行的全流程。

准备环境
为了不影响大家本地的环境，这里使用 Kind 创建出一个独立的 K8s 集群，方便统一版本并且可以在完成快速清理掉。(Docker 双重隔离）

1. 安装 Kind 以及 gRpc 测试工具
```bash
brew install kind
brew install grpcurl
```

2. 拉取镜像
```bash
docker pull kindest/node:v1.16.15
docker pull quay.io/kubernetes-ingress-controller/grpc-fortune-teller:0.1
```

3. 创建 K8s 集群，因为 Kind 是在 Docker 容器里面创建的 K8s，所以宿主机访问，需要把端口暴露出来。Kind 会默认把 K8s apiserver 的端口暴露出来，用来给 kubectl 命令使用。但为了之后的测试，我们提前把几个端口在创建的时候就暴露出来。

Kind 同样支持通过yaml 的形式创建集群
```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 32080
    hostPort: 32080
  - containerPort: 32443
    hostPort: 32443
```

```bash
kind create cluster --name=fortune-teller --image=kindest/node:v1.16.15 --config kind-config.yaml
```

### 运行 Docker 版本
1. 启动容器
```bash
docker run -p 50051:50051 quay.io/kubernetes-ingress-controller/grpc-fortune-teller:0.1
```

`-p` 将容器内的 50051 端口映射到宿主机的 50051 端口

2. 测试应用是否正常运行，第一次运行时可能需要给 grpcurl 开启权限
```bash
grpcurl -plaintext 127.0.0.1:50051 build.stack.fortune.FortuneTeller/Predict
```

应用在收到请求以后，会返回一句名言

![](/asset/k8s-ramp-up/7.png)

### 将应用从 Docker 迁移到 K8s 中

与 Docker 中容器概念相对应的，K8s 中也有着容器的概念。对于虚拟化的容器来说，最佳实践是一个容器一个应用，但当一个服务需要多个应用组合完成时，简单的将多个应用部署到一个容器内，就破坏了应用之间的隔离性，所以 K8s 对于容器进行了一层封装，形成了 Pod 的概念。

#### Pod

Pod 是 Kubernetes 创建或部署的最小基本单元。一个 Pod 封装一个或多个应用容器、存储资源、一个独立的网络 IP 以及管理控制容器运行方式的策略选项。Pod 中的每个容器共享网络命名空间（包括 IP 与端口），Pod 内的容器可以使用 localhost 相互通信。Pod 可以指定一组共享存储卷 Volumes，Pod 中所有容器都可以访问共享的 Volumes。 

通过 Pod，用户就可以非常方便地控制容器之间的隔离性。

有了 Pod 作为基础以后，K8s 就要实现它最重要的功能，对容器的编排管理。当服务需要扩容时，K8s 需要能够快速复制 Pod，当 Pod 挂掉了，K8s 需要能够自动重启。所以 K8s 由此衍生出了 ReplicaSet 的概念。

#### ReplicaSet

ReplicaSet 确保在任何时候都有按配置的 Pod 副本数在运行，通过标签选择器的方式对 Pod 进行筛选和管理。在旧的版本中还有一个 ReplicaController 的概念，RC 与 RS 两者功能完全相同，区别仅仅在于 RS 对于 Pod 的标签选择器更加强大。

开头提到了 K8s 使用声明式的配置自动去管理容器，而 ReplicaSet 的内容却太过具体，涉及到了 Pod 的具体维护细节。所以 K8s 在 ReplicaSet 之上又衍生出声明式配置容器的概念，Deployment。

#### Deployment

Deployment 为 Pod 与 ReplicaSet 提供了声明式的定义，描述你想要的目标状态是什么，Deployment controller 就会帮你将 Pod 与 ReplicaSet 的实际状态改变到你想要的目标状态。

以 fortune-teller 为例子，可以编写一份下面这样的 Deployment 配置文件
```yaml
apiVersion: apps/v1 # k8s api版本
kind: Deployment # 资源类型
metadata:
  name: fortune-teller-app # deployment 名字
  namespace: default
spec:
  replicas: 1 # Pod 副本数量
  selector:
    matchLabels:
      k8s-app: fortune-teller-app # 管理标签中包含 k8s-app: fortune-teller-app 的 Pod
  template: # Pod 模板
    metadata:
      labels:
        k8s-app: fortune-teller-app # Pod 标签
    spec: # Pod 配置
      containers:
      - image: quay.io/kubernetes-ingress-controller/grpc-fortune-teller:0.1
        imagePullPolicy: IfNotPresent
        name: fortune-teller-app
        ports:
        - containerPort: 50051
          name: grpc
          protocol: TCP
```

将上面的内容保存到一份 yaml 文件中，执行以下命令，让 K8s 执行 yaml
```bash
kubectl apply -f deployment.yaml
```

通过以下命令，我们就可以看到刚刚创建的 deployment
```bash
kubectl get deployement
```

![](/asset/k8s-ramp-up/8.png)

此时，K8s 已经自动根据 deployment 中配置的 Pod 模板和配置，创建了 Pod。通过以下命令，我们就可以看到 K8s 自动创建的 Pod
```bash
kubectl get pods
```
![](/asset/k8s-ramp-up/9.png)

因为 K8s 采用声明式的配置去管理 Pod，所以我们可以动态地去修改 deployment 的配置，K8s 会自动根据新的配置去管理 Pod。
```bash
kubectl edit deployment fortune-teller-app
```

我们把配置文件中的副本数量修改为 2

![](/asset/k8s-ramp-up/10.png)

保存退出后，我们再次执行 kubectl get pods ，我们就可以看到 K8s 根据新的配置，创建了一个新的 Pod

![](/asset/k8s-ramp-up/11.png)

现在我们就有了两个 fortune-teller 的服务。在真实环境中，Pod 的调度由 K8s 进行管理，某个时刻服务可能在 Node1 上，而另一时刻服务可能就被调度到了 Node2 上。所以，访问具体 Pod 是一种不稳定的服务访问方法，而且目前大多数的后端服务都是无状态的服务，直接访问 Pod 也导致不能进行负载均衡。所以，K8s 在此基础上衍生出 Service 的概念。

#### Service

Service 可以看做一组提供相同服务的 Pod 的对外访问接口。Kubernetes 提供三种类型的 Service：
- NodePort： 集群外部可以通过 Node IP 与 Node Port 来访问具体某个 Pod，每台机器上都会暴露同样的端口
- ClusterIP：指通过集群的内部 IP 暴露服务，服务只能够在集群内部可以访问，这也是默认的 ServiceType
- ExternalName：不指向 Pod，指向外部服务
Service 和 Deployment 是一对比较容易混淆的概念，两者都是对一组 Pod 进行管理，但它们两者之间的关系可以用下面这张图来概括

![](/asset/k8s-ramp-up/12.png)

Service 是面向服务调用者，也就是外部访问 K8s。而 Deployment 是面向 K8s 底层引擎的，面向内部管理者。

Service 的配置文件格式与 Deployment 很类似
```yaml
apiVersion: v1
kind: Service
metadata:
  name: fortune-teller-service
  namespace: default
spec:
  ports:
  - name: grpc
    port: 50051
    protocol: TCP
    targetPort: 50051
  selector:
    k8s-app: fortune-teller-app
  type: ClusterIP
```

同样的，我们通过 kubectl apply -f service.yaml 命令，可以创建 Service。通过 kubectl get service 可以查看到刚刚创建的 Service。

![](/asset/k8s-ramp-up/13.png)

接下来，我们登陆到一个 Pod 里去测试一下是否可以访问服务。
Netshoot 镜像中包含了一些网络测试的工具，我们可以直接进入一个 netshoot 容器内测试。采用 deployment 的方式创建 Pod
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: netshoot
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: netshoot
  template:
    metadata:
      labels:
        k8s-app: netshoot
    spec:
      containers:
      - args:
        - 1000d
        command:
        - /bin/sleep
        image: nicolaka/netshoot
        name: netshoot
```

与 Docker 的命令类似，使用命令 `kubectl cp grpcurl_1.6.0_linux_x86_64.tar.gz <pod name>:/` 复制工具到容器内。

复制成功后，使用命令 kubectl exec -it <pod name> bash 可以进入到容器内。

解压
```bash
cd /
tar -zxf grpcurl_1.6.0_linux_x86_64.tar.gz
```

然后我们可以测试是否可以从 K8s 集群内访问 Service。对于 K8s 集群内部的服务，K8s 有自己的 DNS 组件，所以可以直接通过服务名访问。
```bash
./grpcurl -plaintext fortune-teller-service:50051 build.stack.fortune.FortuneTeller/Predict
```

![](/asset/k8s-ramp-up/14.png)

验证服务可以从集群内访问之后，我们就需要解决如何从集群外访问服务的问题，毕竟大多数服务是面向 K8s 集群外的用户的。其实目前我们已经了解了一种解决方案，就是使用 Nodeport 类型的 Service。但采用这种方法有几个缺点：
1. 每个端口只能是一种服务
2. 端口范围只能是 30000-32767
3. 如果节点 的 IP 地址发生变化，调用方需要能够察觉。
所以，K8s 为服务的外部访问路由提供了新的类型 Ingress。

#### Ingress
Ingress 其实是一种类似于路由表一样的配置，实际的路由工作需要 Ingress Controller 执行。K8s 本身并没有提供 Ingress Controller，目前常用的是通过 Nginx 实现的版本 https://github.com/kubernetes/ingress-nginx 。可以使用上面压缩包中的 ingress-controller.yaml 安装

![](/asset/k8s-ramp-up/15.png)

Ingree nginx controller 通过宿主机暴露给外部访问的端口是随机的，所以我们修改 yaml，改成我们在一开始创建集群时映射的端口。

通过 `kubectl get svc -n ingress-nginx` 我们就可以看到，暴露的是两个随机分配的端口

![](/asset/k8s-ramp-up/16.png)

我们手动将其改成 32080 和 32443。

![](/asset/k8s-ramp-up/17.png)

Ingress nginx controller 同样是通过标签选择器的方式管理 Ingress。

下面是一个简单的 Ingress，将发往 Host fortune.bytedance.com 的请求路由到 Service fortune-teller-service。
```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: GRPC
  name: fortune-ingress
  namespace: default
spec:
  rules:
  - host: fortune.bytedance.com
    http:
      paths:
      - backend:
          serviceName: fortune-teller-service
          servicePort: grpc
```

安装 Ingress
```bash
kubectl apply -f ingress.yaml
kubectl get ingress
```

![](/asset/k8s-ramp-up/18.png)

Ingress nginx controller 对于 gRpc 默认只支持 SSL 的形式，而Fedlearner 中的 controller 做了一些定制化操作，使得通过 80 端口，只使用 HTTP2 也可以转发 gRpc。详情可以参考 https://github.com/bytedance/ingress-nginx/pull/2/files

使用下面这个命令，我们可以测试一下从外部访问服务
```bash
grpcurl -insecure -servername 'fortune.bytedance.com' 0.0.0.0:32443 build.stack.fortune.FortuneTeller/Predict
```

![](/asset/k8s-ramp-up/19.png)

刚才也提到了，gRpc 通常是使用 SSL 进行加密的，SSL 的关键在于公钥，私钥以及证书的验证。通过文件系统的方式确实可以处理证书的问题，但 K8s 抽象出 Secret 这种资源，大大提高了对这类文件的管理和复用能力。

#### Secret

Secret 解决了密码、token、密钥等敏感数据的存储问题，主要分为三种类型：
- Service Account ：用来访问 Kubernetes API，由 Kubernetes 自动创建，并且会自动挂载到 Pod 的 / run/secrets/kubernetes.io/serviceaccount 目录中
- Opaque ：Base64 编码格式的 Secret，用来存储密码、密钥等
- kubernetes.io/dockerconfigjson ：用来存储 docker registry 的认证信息

接下来，我们就来创建一个 Opaque 类型的 Secret，使得 ingress nginx controller 支持服务端的 SSL。
由于篇幅有限，这里简单介绍下证书相关的概念：
- CA：证书授权中心(certificate authority)，用来签发私钥，并验证公钥，私钥的合法性
- 私钥，公钥：私钥用于加密，公钥用于解密

Secret 支持不编写 yaml，直接从文件中创建 Secret
```bash
kubectl create secret generic fortune-teller-ssl-verify \
  --from-file=ca.crt=CA.pem \
  --from-file=tls.crt=server-public.pem \
  --from-file=tls.key=server-private.key
```

修改 Ingress，使其使用新创建的 Secret 提供服务侧的 SSL。
```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: GRPC
  name: fortune-ingress
  namespace: default
spec:
  rules:
  - host: fortune.test.com
    http:
      paths:
      - backend:
          serviceName: fortune-teller-service
          servicePort: grpc
  tls:
  - hosts:
    - fortune.test.com
    secretName: fortune-teller-ssl-verify
```

因为我们使用的是自签名的证书，不被公共的 CA 所信任，所以在发送请求是需要手动指定自己所信任的 CA。

```bash
grpcurl -cacert CA.pem \
  -servername 'fortune.test.com' \
  127.0.0.1:32443 \
  build.stack.fortune.FortuneTeller/Predict
```

![](/asset/k8s-ramp-up/20.png)

## 参考
- https://draveness.me/docker/
- https://www.yuque.com/kshare/2020/fe3b6f86-3b9b-48da-9770-897d838cbf41?language=zh-cn#Namespace
- https://network.51cto.com/art/201907/598970.htm
- https://blog.csdn.net/gatieme/article/details/51383322

