---
title: "Spring Cloud IPv6端口问题排坑"
categories:
- Backend
tags:
- Spring Cloud
---

## 场景
使用 Spring Cloud Eureka 搭建服务注册中心，使用 Zuul 搭建服务网关，一套比较传统的微服务架构。
服务注册中心的地址为 http://localhost:8888，Zuul 网关地址为 http://localhost:8080， 另外搭建一个服务名为 metadata-service 的服务，地址为 http://localhost:8088。
## 问题
在 metadata-service 中提供一个测试的接口
```Java
@RestController
public class MetadataController {
​
    @GetMapping(value = "/test")
    public int getTest() {
        return 1;
    }
}
```
使用 Postman 进行测试，结果发现直接请求 http://localhost:8088/test 即 metadata-service 的地址，可以正常得到结果

![](/asset/spring_ipv6/1.jpg)

而通过网关，使用 Zuul 默认路由规则，调用服务，会出现 404 的错误

![](/asset/spring_ipv6/2.jpg)

## 分析
首先，我们可以先通过 http://localhost:8888 查看服务是否注册到了服务注册中心

![](/asset/spring_ipv6/3.jpg)

可以看到没有任何问题。
那么，我们再检查网关有没有获取到 metadata-service 的路由。可以通过 http://localhost:8080/actuator/routes 查看（actuator默认是关闭的，可以通过配置 management.endpoints.web.exposure.include=* 开启）。

![](/asset/spring_ipv6/4.jpg)

同样，我们可以看到没有任何问题。
那么，就很奇怪了🤨，服务本身没有任何问题，直接调用也可以访问，而通过网关一转发，为什么就 404 了呢？在网上查了一下午，也没有找到有人遇到过类似的问题。。。😱
问题的关键在我关闭服务后再次请求 http://localhost:8088/test 时终于找到了。正常情况下，关闭了服务后，应该没有返回的 response，但发出请求过后仍然是 404

![](/asset/spring_ipv6/5.jpg)

那么，就很明显了，有另一个进程也在监听 8088 端口 ！！！
但还是很奇怪，那为什么服务启动的时候没有报端口被占用的错误呢？？？
重新启动服务，使用 lsof -i tcp:8088 （Mac OS）查看端口占用情况

![](/asset/spring_ipv6/6.jpg)

果然有两个进程同时在监听，而一个是 IPv4，一个是 IPv6的。
首先，根据这篇文章 https://blog.csdn.net/jiyiqinlovexx/article/details/50959351 的解释，多个进程是完全可以同时监听同一个端口的。
而从 Java 7 开始，默认使用 IPv6 而不是 IPv4 （https://stackoverflow.com/questions/35470838/localhost-vs-127-0-0-1-in-spring-framework），所以对于 Spring 的 localhost 来说，其实真正使用的 IP 地址是 ::1，而不是 127.0.0.1 。使用 Postman 进行测试，可以发现 http://[::1]:8088/test 得到正常结果，而 http://127.0.0.1:8088/test 则为 404 。这就完美地解释了开启服务与停止服务，返回结果不同的问题，Spring 服务所对应的正是那个 IPv6 的进程。
那么，为什么网关转发就到了 IPv4 呢？我们再来看一下服务注册中心里的信息

![](/asset/spring_ipv6/7.jpg)

可以看到其实 Eureka 保存的是每个服务的 IP 地址是本机的 IPv4 的内网地址，而不是保存域名，这就是问题的关键。我们可以使用 Postman 发送请求  http://localhost:8080/metadata-service/test 后，使用命令 lsof -i tcp:8088 进行验证。

![](/asset/spring_ipv6/8.jpg)

可以看到的确是向内网 IP 地址，而不是向 localhost 转发请求。
## 解决方案
至此，问题的原因已经完全清楚了，果然程序都是 debug de 出来的。
最简单的方法也很清楚了，换个端口号就 OK 了。

如果本文有错误或者理解不对的地方，欢迎指正！！！😆

那么，占了 8088 端口的 IPv4 进程是哪个程序呢？🤨







。。。。Hadoop 出来挨打！！！😭😭😭