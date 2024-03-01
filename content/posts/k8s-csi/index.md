---
title: "K8s挂载外部存储详解"
date: 2024-03-01 12:00:00+0800
categories:
  - Cloud
tags:
  - K8s
---
在当今迅速发展的云计算时代，Kubernetes（K8s）已成为容器编排领域的事实标准。随着企业和开发者越来越依赖于微服务架构来构建和部署应用程序，对于持久化存储解决方案的需求也日益增加。K8s提供了强大的工具和资源，用于管理和自动化容器化应用程序的部署、扩展和运维，但是，将外部存储挂载到K8s环境中，以确保数据的持久性和可靠性，对于很多开发者和系统管理员来说，仍然是一个具有挑战性的任务。
本文旨在详细解析K8s如何挂载外部存储，从而帮助读者深入理解K8s的CSI、持久卷（Persistent Volumes, PV）和持久卷声明（Persistent Volume Claims, PVC）的工作原理。

## CSI Plugin组件
在K8s中，有两种挂载外部存储的方式，In-Tree和Out-of-Tree。In-tree 存储插件是直接集成在K8s代码库中的存储插件，由Kubernetes开发团队维护。而Out-of-tree存储插件不是K8s代码库的一部分。它们通常由存储供应商单独开发和维护，并通过Container Storage Interface (CSI)与K8s集成。
CSI Plugin主要可以分为两个部分：DaemonSet和Deployment。DaemonSet负责与Node相关的操作，Deployment负责与Volume相关的操作。

<img src="./Pasted image 20240301124710.png" style="width:100%;margin-left:auto;margin-right:auto;">

K8s External Component：
* Node Driver Rigistrar：负责将CSI驱动注册到Node上，使得K8s能够识别并使用这个CSI驱动提供的存储功能。这包括将CSI驱动的信息注册到kubelet，以便在调度Pod时，K8s知道该节点上可用的CSI驱动和其功能。
* External Attacher：负责处理PV的attach和detach操作，调用Custom Component的Publish和Unpublish操作。
* External Provisioner：负责监听PVC的创建，并创建PV资源。调用Custom Component的Create和Delete操作。

Custom Component：
Custom Component本质上就是一些运行着grpc服务的Pod，向外暴露一些接口，供K8s调用。
* Identity Service：负责对外提供插件本身的信息
* Controller Service：负责执行一些与Volume相关，但与宿主机无关的操作。例如，`CreateVolume`中可以去调用远端的云服务，例如S3，去创建bucket。
* Node Service：负责执行与Node宿主机相关的操作。例如，将nfs mount到宿主机，再进一步mount到Pod中。

## 一般流程

<img src="./Pasted image 20240301124559.png" style="width:100%;margin-left:auto;margin-right:auto;">

从用户创建一个带有PV的Pod开始，K8s处理外部存储的过程主要可以分为三个阶段：Schedule、Provision、Attach和Mount。
### Schedule

<img src="./Pasted image 20240301124821.png" style="width:100%;margin-left:auto;margin-right:auto;">

1. 用户请求API Server，创建Pod、PVC等资源。
2. Scheduler监听Pod资源。
3. Scheduler根据调度规则，为Pod选择一个合适的Node。之后并不会进一步处理Pod，而是等待Pod所依赖的资源（例如，PV）创建好之后，才会进行实际的调度。
4. 为PVC添加annotation：volume.kubernetes.io/selected-node。

### Provision

<img src="./Pasted image 20240301125008.png" style="width:100%;margin-left:auto;margin-right:auto;">

5. PV Controller和External Provisioner同时都在监听PVC资源。如果PVC是In-Tree模式，那么则会由PV Controller进行处理。如果是Out-of-Tree模式，那么则会由External Provisioner进行处理。
6. External Provisioner通过GRPC，根据PVC的类型，调用CSI Plugin中对应Controller Service的`CreateVolume`，创建Volume。在这里，第三方的CSI Plugin就可以去在远程创建存储资源。创建好之后，Volume资源的状态为`CREATED`，暂时没有暴露给Node和Pod。
7. External Provisioner创建PV资源。
8. 并将PV与PVC进行绑定。
9. Scheduler将Pod调度到具体的Node上。

### Attach

<img src="./Pasted image 20240301125026.png" style="width:100%;margin-left:auto;margin-right:auto;">

10. Attach Controller监听PV资源。
11. 并创建VolumeAttachment资源。
12. External Attacher监听VolumeAttachment资源。
13. 并通过GRPC，调用Controller Service的`ControllerPublishVolume`接口。对于某些文件系统，例如nfs来说，不需要额外操作就可以挂载，那么这个方法其实不需要实现。而对于更加定制化的FUSE来说，Publish操作其实是一个非常重要的操作，这里将在下一节中详细展开。
14. Volume挂载到了Node上。此时，Volume的状态为`NODE_READY`，Node已经可以感知Volume，但Pod仍然无法感知。

### Mount

<img src="./Pasted image 20240301125038.png" style="width:100%;margin-left:auto;margin-right:auto;">

15. kubelet中的VolumeManager，监听是否有新的带有PV的Pod被调度到当前Node上。然后，VolumeManager调用Node Service执行挂载。
16. VolumeManager主要调用Node Service进行了两个操作：
	1. `MountDevice`：调用Node Service的`NodeStageVolume`接口，对Volume进行格式化，并挂载到一个宿主机目录中。目录通常为：`/var/lib/kubelet/pods/<Pod的ID>/volumes/kubernetes.io~<Volume类型>/<Volume名字>`。此时，Volume进入`VOL_READY`状态。
	2. `SetUp`：调用Node Service的`NodePublishVolume`接口，将Volume挂载到容器中。实现方法是在容器启动时，开启mount namespace，并调用Linux的`bind mount`api，将宿主机目录挂载到容器目录中。此时，Volume已经对容器可用，进入`PUBLISH`状态。
17. 最后，kubelet向API server更新Pod的状态。

## FUSE
FUSE（Filesystem in Userspace）是一种使用户空间程序能够提供文件系统操作的接口机制。这意味着通过FUSE，你可以创建自己的文件系统而无需修改内核代码。FUSE非常灵活，被广泛用于各种场合，如云存储客户端、加密文件系统、以及为特定任务定制的文件系统等。
要想将OSS，Google Driver这些不是传统文件系统的存储接入到K8s中，那么我们必须要实现对应的FUSE。
首先，我们先来了解一下FUSE的原理和工作过程。

<img src="./Pasted image 20240222152453.png" style="width:100%;margin-left:auto;margin-right:auto;">

图源：[Wikimedia](https://commons.wikimedia.org/wiki/File:FUSE_structure.svg)

1. 用户空间的应用程序发起一个文件系统相关的系统调用，例如`open()`或`read()`。
2. **调用传递给内核**：系统调用首先被传递到操作系统内核。
3. **VFS层处理**：内核中的VFS接收到这个调用，并负责解析路径名，找到对应的文件系统和文件。VFS作为一个抽象层，允许这个调用以一种与底层文件系统无关的方式被处理。这意味着，不论文件实际位于EXT4、XFS、或通过FUSE实现的自定义文件系统，VFS提供统一的接口来处理这些请求。
4. **确定文件系统类型**：VFS通过分析请求的路径来确定目标文件所在的文件系统。如果这个文件系统是一个传统的内核文件系统（如EXT4），VFS将直接调用该文件系统的相关操作函数。
5. **FUSE处理（如果适用）**：如果目标文件位于一个通过FUSE挂载的文件系统，VFS会将请求转发给FUSE内核模块。FUSE内核模块再将请求发送到对应的用户空间程序。这个用户空间程序实现了文件系统的逻辑，处理完请求后，将结果返回给FUSE内核模块，然后返回给VFS。
6. **操作完成**：一旦文件系统（不论是内核文件系统还是FUSE文件系统）处理完请求，操作的结果会被传回给VFS。
7. **用户空间接收响应**：VFS将操作结果返回给用户空间的应用程序。如果操作成功，应用程序将继续执行；如果失败，通常会返回一个错误码。
可以看到，FUSE本质上是一个用户进程。那么，在K8s中将FUSE作为外部存储时，就需要启动一个Pod，来运行FUSE。（以下的流程仅为一种解决方案，由于FUSE的灵活性，当然存在其他可行的方案。）

<img src="./Pasted image 20240301125118.png" style="width:100%;margin-left:auto;margin-right:auto;">

我们回顾Attach阶段，Controller Service的`ControllerPublishVolume`会负责将Volume挂载到Node上。在这个时刻，我们已经有了Volume和Node这两个资源。那么，我们也可以在这个地方创建FUSE的Pod，并调度其到指定的Node上。并且，我们将宿主机的一个临时目录，挂载（bind mount）到FUSE Pod中，并作为FUSE的挂载点（也就是该目录下的所有操作都是由FUSE处理的）。而在User Pod中，也同样挂载（bind mount）该宿主机目录。这样通过在两个Pod之间共享宿主机目录的方法，实现User Pod将FUSE作为外部存储。值得注意的是，这一过程虽然挂载了宿主机目录，但所有的数据IO都是位于内存中的，不会涉及到磁盘操作。

综上所述，本文详细地介绍了K8s中CSI相关的工作原理，并且更进一步，介绍了一个更常用的场景，如何在K8s中使用FUSE。

参考：
1. [CSI 驱动开发指南 | 云原生社区（中国）](https://cloudnative.to/blog/develop-a-csi-driver/)
2. [云计算K8s组件系列—- 存储CSI](https://kingjcy.github.io/post/cloud/paas/base/kubernetes/k8s-store-csi/)
3. [Kubernetes教程(九)---Volume 实现原理 -](https://www.lixueduan.com/posts/kubernetes/09-volume/)
4. [Kubernetes教程(十四)---PV 从创建到挂载全流程详解 -](https://www.lixueduan.com/posts/kubernetes/14-pv-dynamic-provision-process/)
5. [Write a filesystem with FUSE](https://engineering.facile.it/blog/eng/write-filesystem-fuse/)
6. [GitHub - rflament/loggedfs: LoggedFS - Filesystem monitoring with Fuse](https://github.com/rflament/loggedfs)
