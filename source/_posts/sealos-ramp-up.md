---
title: "[Introduction] Sealos is All You Need —— 3分钟部署 kubernetes "
math: true
date: 2022-10-30 21:00:00
updated: 2022-10-30 21:00:00
---

![title.png](/asset/sealos-ramp-up/f6ce5cbedc6aa338007cd4633935ad371086271c.png)

## Sealos 是什么？

Kubernetes（K8s）发展至今，已经成为了一个及其复杂的系统。而作为云原生的基石，涌现了一大批辅助工具，帮助用户快速搭建 k8s 集群。而其中，[Sealos](https://github.com/labring/sealos) 是做的最为极致的工具之一。接下来，让我们通过一个例子来看看 Sealos 的强大。

## 如何使用

![Frame 3.png](/asset/sealos-ramp-up/313c52bda7b27b5b64a479e488404bcef56b2669.png)

假设我们想要在 192.168.0.100，192.168.0.101 和 192.168.0.102 这三台机器上部署一主两从的 K8s 集群，那么使用 Sealos 的话，主要输入以下的命令：

```
sudo sealos run labring/kubernetes:v1.24.0 labring/calico:v3.22.1 \
    --masters 192.168.0.100 \
    --nodes 192.168.0.101,192.168.0.102 \
    --passwd xxx
```

是的，Sealos 将一个复杂的 K8s 的集群部署简化成了短短一行命令，将部署体验拉到了极致。甚至不需要过多的文档解释，仅凭这一行命令就可以满足大多数普通的部署场景。

## 原理

那么，如此强大的 Sealos 是如何运行的呢？除了刚才演示的 `run` 命令之外，Sealos 还提供了大量提升用户体验的命令，例如 `create` 创建镜像、`reset` 格式化集群等等。由于篇幅有限，本章节就以最核心的 `run` 命令为例，看看 Sealos 在背后替用户完成了哪些自动化的操作。（本文以 Sealos V4.1.0 代码为例）

### Applier

首先，Sealos 会创建一个 `Applier` 结构体，负责了部署集群的核心逻辑。`Applier` 采用了 k8s 的声明式的设计思想，用户声明一个期望的集群状态，而 `Applier` 负责将集群现在的状态转换成用户期望的状态。

```go
type Applier struct {
    ClusterDesired     *v2.Cluster // 用户期望的集群状态
    ClusterCurrent     *v2.Cluster // 集群当前状态
    ClusterFile        clusterfile.Interface // 当前集群接口
    Client             kubernetes.Client
    CurrentClusterInfo *version.Info
    RunNewImages       []string // run 命令新增的镜像名称
}
```

`clusterfile.Interface` 是一个接口类型，Sealos 中通过 `ClusterFile` 实现了这一接口。因此，`Applier` 结构体中最重要的就是 `Cluster` 和 `ClusterFile` 这两个类型，它们定义了集群的状态和配置。接下来，我们展开介绍一下两者。

#### Cluster

```go
type Cluster struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`

    Spec   ClusterSpec   `json:"spec,omitempty"`
    Status ClusterStatus `json:"status,omitempty"`
}
type ClusterSpec struct {
    Image ImageList `json:"image,omitempty"`
    SSH   SSH       `json:"ssh"`
    Hosts []Host    `json:"hosts,omitempty"`
    Env []string `json:"env,omitempty"`
    Command []string `json:"command,omitempty"`
}
type ClusterStatus struct {
    Phase      ClusterPhase       `json:"phase,omitempty"`
    Mounts     []MountImage       `json:"mounts,omitempty"`
    Conditions []ClusterCondition `json:"conditions,omitempty" `
}
```

`Cluster` 的内容按照 K8s Resource 的格式进行了设计，这非常的 K8s 哈哈。在 `ClusterSpec` 中，定义了一系列用于部署 K8s 集群的参数，例如，镜像、SSH参数、节点等等。

而在 `ClusterStatus` 中，`Phase` 定义了当前集群的状态，`Mounts` 定义了集群使用的镜像，`Conditions` 保存了集群中所发生的一系列事件。

#### ClusterFile

```go
type ClusterFile struct {
    path         string // 保存路径
    customValues []string
    customSets   []string
    customEnvs   []string
    Cluster      *v2.Cluster // 集群状态
    Configs      []v2.Config
    KubeConfig   *runtime.KubeadmConfig // 集群配置
}
```

`ClusterFile` 是真正被 `Applier` 操作的对象，以及持久化到文件中的内容。这里包含了所有集群的当前状态信息，同时还包含了 kubeconfig。这里的 kubeconfig 并不是我们平时操作 k8s 时所用的 config 文件，而是一系列用于搭建集群所需的配置项。在使用 `kubeadm` 时，这些配置项往往需要我们手动配置，而 Sealos 在这里会自动帮我们填写并应用于集群中。可以看出，`Cluster` 更像是 `ClusterFile` 的一个实例，记录了集群实时的状态。

### 创建 Applier

创建一个 `Applier` 会经过以下步骤：

1. 判断是否已经存在 `ClusterFile` ，如果存在，那么直接读取，构建出集群状态 `Cluster`。否则，初始化创建一个空的集群状态 `Cluster`。

2. 根据用户本次的参数，更新集群状态 `Cluster` 中的 spec，此时，`Cluster` 即为目标的集群状态。

3. 再次从文件中构建 `ClusterFile`，作为集群当前的状态和对象。

4. 构建 `Applier` 结构体返回。

### Apply

接下来，通过 `Applier.Apply()`，Sealos 开始正式的部署集群，使集群状态向目标靠近。首先，Sealos 会将当前集群的状态置为 `ClusterInProcess`。接下来，根据集群创建或是更新，分别进入两个分支。

#### initCluster

`initCluster` 负责从零开始创建一个集群。函数中会通过 `CreateProcessor` 去部署期望状态的集群。

```go
type CreateProcessor struct {
    ClusterFile     clusterfile.Interface // 当前集群对象
    ImageManager    types.ImageService // 处理镜像
    ClusterManager  types.ClusterService // 管理 clusterfile
    RegistryManager types.RegistryService // 管理镜像 registry
    Runtime         runtime.Interface // kubeadm 对象
    Guest           guest.Interface // 基于 sealos 的应用对象
}
```

![Slide 16_9 - 1.png](/asset/sealos-ramp-up/c668a66b40dbc788695a9cbb8ec3f76a9897503a.png)



`CreateProcessor.Execute` 接收期望的集群状态 `ClusterDesired`。接下来会执行一系列 pipeline，正式进入实际的集群部署过程中：

1. Check：检查集群的 host

2. PreProcess：负责集群部署前的镜像预处理操作，在这里就会利用 `CreateProcessor` 中的各个 Manager。
   
   1. 拉取镜像
   
   2. 检查镜像格式
   
   3. 使用 `buildah` 从 OCI 格式的镜像中创建 working container，并将容器挂载到 rootfs 上
   
   4. 将容器的 manifest 添加到集群状态中

3. RunConfig：将集群状态中的 working container 导出成 yaml 格式的配置并持久化到宿主机的文件系统中

4. MountRootfs：将挂载的镜像内容按照类别，以 `rootfs`，`addons`，`app` 的顺序分发到每台机器上。
   
   这里需要介绍一下 sealos 镜像的一般结构，以最基础的 k8s 镜像为例：
   
   ```
   labring/kubernetes
   - etc // 配置项
   - scripts // 脚本
       - init-containerd.sh
       - init-kube.sh
       - init-shim.sh
       - init-registry.sh
       - init.sh
   - Kubefile // dockerfile 语法，定义了镜像的执行逻辑
   ```
   
   K8s 作为整个集群的基础，虽然最终镜像内的目录结构与其他一致，但其构建过程稍微有所不同。在 CI [https://github.com/labring/cluster-image/blob/faca63809e7a3eae512100a1eb8f9b7384973175/.github/scripts/kubernetes.sh#L35](https://github.com/labring/cluster-image/blob/faca63809e7a3eae512100a1eb8f9b7384973175/.github/scripts/kubernetes.sh#L35) 中，我们可以看到，k8s 镜像其实是合并了 cluster-image 仓库下的多个文件夹，`containerd`，`rootfs` 和 `registry`。这些独立的文件夹中包含有安装对应组件的脚本。
   
   Sealos 在挂载一个镜像后，会首先执行 `init.sh` 脚本。例如，以下是 k8s 镜像的脚本中，分别按顺序执行了 `init-containerd.sh` 安装 containerd，`init-shim.sh` 安装 image-cri-shim 和 `init-kube.sh` 安装 kubelet。
   
   ```
   source common.sh
   REGISTRY_DOMAIN=${1:-sealos.hub}
   REGISTRY_PORT=${2:-5000}
   
   # Install containerd
   chmod a+x init-containerd.sh
   bash init-containerd.sh ${REGISTRY_DOMAIN} ${REGISTRY_PORT}
   
   if [ $? != 0 ]; then
      error "====init containerd failed!===="
   fi
   
   chmod a+x init-shim.sh
   bash init-shim.sh
   
   if [ $? != 0 ]; then
      error "====init image-cri-shim failed!===="
   fi
   
   chmod a+x init-kube.sh
   bash init-kube.sh
   
   logger "init containerd rootfs success"
   ```
   
   在 MountRootfs 这步中，只会执行 `rootfs` 和 `addons` 类型的 `init.sh` 脚本。这也很好理解，因为到目前为止，Sealos 仅仅在每台机器上安装成功了 kubelet，整个 k8s 集群还未可用。

5. Init：初始化 k8s 集群。在这步中，其实也是执行了一系列的子操作。
   
   1. Sealos 会从 `ClusterFile` 中加载 `kubeadm` 的配置，然后拷贝到 master0 上。
   
   2. 根据 master0 的 hostname 生成证书以及 k8s 配置文件，例如 `admin.conf`，`controller-manager.conf`，`scheduler.conf`，`kubelet.conf`。
   
   3. Sealos 将这些配置以及 rootfs 中的静态文件（主要是一些 policy 的配置）拷贝到 master0 上。
   
   4. Sealos 通过 link 的方式将 rootfs 中的 registry 链接到宿主机的目录上，然后执行脚本 `init-registry.sh`，启动 registry 守护进程。
   
   5. 最后也是最重要的，初始化 master0。首先，将 registry 的域名，api server的域名（IP 为 master0 的 IP）添加到 master0 宿主机上。然后，调用 `kubeadm init` 创建 k8s 集群。最后，将生成的管理员 kubeconfig 拷贝到 `.kube/config`。

6. Join：使用 kubeadm 将其余 master 和 node 加入现有的集群，然后更新 `ClusterFile`。此时，整个 k8s 集群就已经搭建完毕了。

7. RunGuest: 运行所有类型为 `app` 的镜像的 CMD，安装所有应用。

至此一个 k8s 集群以及基于这个集群的所有应用都被安装完毕。

#### reconcileCluster

第二个分支是负责集群的更新，大部分内容与 `initCluster` 都比较类似。执行主要包含了以下几步：

1. ConfirmOverrideApps: 确认是否覆盖已有的应用。

2. PreProcess, RunConfig, MountRootfs, RunGuest: 都与 `initCluster` 类似。

3. PostProcess: 执行一些安装后的操作，但目前似乎并没有进行任何操作。

## 不仅仅如此...

经过上文的介绍，可以看到 Sealos 本质上也可以认为是一个强大的 k8s 安装脚本。但未来的 Sealos 不仅仅如此，基于 Sealos 所开发的 sealos cloud 将会成为一个以 k8s 为内核的云操作系统，为更多应用的云原生之路带来更多便利。

![](/asset/sealos-ramp-up/1ef54cfebd1c76bc8ecfd9897f9f127107b6e555.png)
