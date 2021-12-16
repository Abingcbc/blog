---
title: "[CodeRead] TiDB Lightning"
date: 2021-03-19 18:48:44
categories:
- CodeRead
tags:
- TiDB
---

TiDB Lightning 是一个将数据导入到 TiDB 中的工具，使用 Go 编写。支持 `Local`, `Importer`, `TiDB` 三种导入模式。在 TiDB 的官网中，对其[原理]()有着详细的介绍。

本文从代码的角度，带领大家走过一个数据导入的过程，所以只关注一些逻辑上重要的步骤，而一些其他的细节可能不会涉及到。
<!-- more -->

![](/asset/tidb-lightning/1.png)
首先，进入 main 函数，程序调用了两个主要的启动函数：`GoServer` 和 `RunServer`。

## GoServer

[https://github.com/pingcap/br/blob/0b223bc5358cbe7ef6a54ad10fdd7aca81bf547f/pkg/lightning/lightning.go#L96](https://github.com/pingcap/br/blob/0b223bc5358cbe7ef6a54ad10fdd7aca81bf547f/pkg/lightning/lightning.go#L96)

GoServer 启动了一个 Api Server，有着以下这些 endpoint
- /web
- /metrics
- /debug
- /tasks
- /progress
- /pause
- /resume
- /loglevel

Api Server 为整个 lightning 提供了控制，监控和查看进度等功能。是用户与 lightning 交互的入口。而当用户通过 `POST /tasks` 提交了一个数据导入任务时，Api Server 就会向队列中添加一个任务，而同样在监听着队列的 RunServer 就会开始执行。

## RunServer

[https://github.com/pingcap/br/blob/0b223bc5358cbe7ef6a54ad10fdd7aca81bf547f/pkg/lightning/lightning.go#L194](https://github.com/pingcap/br/blob/0b223bc5358cbe7ef6a54ad10fdd7aca81bf547f/pkg/lightning/lightning.go#L194)

RunServer 是真正执行导入的地方。一个 for 循环一直从队列中获取任务配置。在获取到一个任务的配置后，开始正式执行导入任务。

### RegisterMySQL

这个函数的命名有点迷惑，但所幸有注释。RegisterMySQL 同时包含了向 gomysql driver 配置 TLS 和解除配置的两个作用。在运行的一开始，注册 TiDB 的 TLS 配置，这样直接可以使用 `sql.open()` 连接 TiDB。在执行导入任务结束后，通过将 `CAPath` 置为空，删除 TLS 配置。

### Glue

Glue 将数据和导入粘合在一起。这里在创建 Glue 时，就将 TiDB 设为了导入模式。

### MyDumper

确定好目标数据库也就是 backend 后，我们就可以看看数据导入的 frontend 了。`MyDumper` 是一款由 PingCAP 基于社区版，为 TiDB 定制化开发的数据导出工具。但是目前似乎已经不推荐使用了，推荐改用 `dumpling` 了。

在这里创建 MyDumper 时，就会在 `setup` 中从 SQL 文件中。 这里会对表按从小到大进行排序，让小表之后先进行导入，这样可以避免大表导入时阻塞小表释放 index worker。

```go
type mdLoaderSetup struct {
	loader        *MDLoader
	dbSchemas     []FileInfo
	tableSchemas  []FileInfo
	viewSchemas   []FileInfo
	tableDatas    []FileInfo
	dbIndexMap    map[string]int
	tableIndexMap map[filter.Table]int
}
```

### Check

初始化并配置好 MyDumper 后，在正式开跑前，程序还需要进行检查。这里检查了两项：1. `CheckSystemRequirement` 系统要求是否满足，lightning 对于内存要求似乎还挺高。2. `CheckSchemaConflict` 检查目标数据库的 Schema 是不是有冲突。

## RestoreController

lightning 的导入过程由 `RestoreController` 进行控制。`Run` 中的 `opts` 定义了导入过程所有的操作。

### CheckRequirements

通过多态实现，三种 backend 执行不同的检查。

### SetGlobalVariables

在 Server 模式下，目标数据库的 `Collation` 设置都可能不同，所以每次执行任务都需要设置一下。

### RestoreSchema

从这里，lightning 真正开始导入数据。首先，导入 Schema。Schema 包含 `database`, `table`, `view` 三个部分，分别对应着之前从 MyDumper 中导出的三个部分。Lightning 使用 Glue 中封装的目标数据库连接，执行 SQL，导入 Schema 信息。

这里 lightning 使用了一种非常 Go 风格的实现方法。先创建出多个 goroutine，每个 goroutine 都监听着同一个 channel。之后再不断向 channel 中加入要执行的 SQL 任务，从而实现一个类似于线程池的功能。

在导入 Schema 成功后，RestoreSchema 还会负责初始化 Checkpoint，并创建一个 goroutine，用来监听 Checkpoint 的变化，将多个 Checkpoint 合并到一起。

最后，RestoreSchema 还会根据 Schema 中包含的元信息，对之后导入数据时划分的 chunk 数量进行一个估计。

### RestoreTables

RestoreTables 负责从源数据库中导出数据到目标数据库中。

首先，在 `populateChunks` 函数中，使用 MyDumper 将数据划分成多个 chunk，接着将 chunk 加入到其对应的数据 engine 中。然后添加一个索引 engine 的 Checkpoint。

然后，通过 `InsertEngineCheckpoint` 创建每张表的 Checkpoint。

然后，在 `restoreEngines` 中，先将源数据库的数据从导出的文件，并发地转化成 KV 格式的 engine，然后再导入到目标数据库中。关于 engine 的状态机模型，可以参考我的另一篇[文章](https://blog.abingcbc.cn/2021/03/17/tikv-importer)中的总结。这个函数中包含了 lightning 最核心的逻辑，所以比较复杂，大致可以分为以下几个过程：

1. 在 chunkRestore 的 `restore` 中，在 `encodeLoop` 中，利用 MyDumper 的 parser，将数据从不同的导出格式统一转换成 KV 格式，插入到 engine 中。此时，所有的 Checkpoint，包括 data 和 index，都已经写入完成。
2. 接着，根据 engine 的状态机，关闭 engine 才能开始导入，所以我们现在需要将 engine 的状态置为 close。
3. 关闭后，开始调用 backend 导入 engine。在所有的 data engine 导入完成后，开始导入 index engine。

这里，又使用了一种非常 Go 风格的方式实现线程池的功能。利用 channel 的缓冲特性，向其中添加 worker，使用时取走，使用完再放回到 channel 中。

最后，对于某些需要执行 post process 的任务，执行一下相应的任务。

### FullCompact

调用 TiKV 的接口，对所有新导入的数据进行压缩。但是由于之前导入数据的时候，会根据是否存在压缩任务，去尝试执行 level-1 的压缩，所以进行全量压缩的时候，需要等待之前启动的 level-1 压缩任务结束。

### SwitchToNormalMode

将 TiKV 切换成正常模式

### CleanCheckpoints

所有的导入任务都结束了，此时 checkpoint 已经无用了。所以，根据用户配置是否删除，处理 checkpoint。