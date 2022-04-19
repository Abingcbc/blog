---
title: "[Introduction] Kubernetes CronJob"
date: 2021-03-08 00:06:14
categories:
- Introduction
tags:
- Kubernetes
---
本文主要介绍下 K8s 的 CronJob，还有其中的一些小坑。

## 概念
Cronjob 是 K8s 定时通过 cronjob controller 定时去创建 Job 实现的。
创建 Cronjob 的一个例子：
```yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: hello
spec:
  schedule: "*/1 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: hello
            image: busybox
            imagePullPolicy: IfNotPresent
            args:
            - /bin/sh
            - -c
            - date; echo Hello from the Kubernetes cluster
          restartPolicy: OnFailure
```

## Cronjob controller 工作原理
startingDeadlineSeconds 是一个很重要的参数，其配置了一个周期创建job时，多长时间算作失败。
1. Controller 每10秒轮询一次 cronjob
2. 对于每个 cronjob，计算从上次被调度 lastScheduleTime 到现在错过了多少次调度。如果大于100次，则将其状态置为 FailedNeedsStart
3. 对于其他 cronjob 计算当前是否还在其 lastScheduleTime + startingDeadlineSeconds 内，如果在，则进行调度。如果不在，则发送一条 event
"Missed starting window for {cronjob name}. Missed scheduled time to start a job {scheduledTime}"

## Tips
1. 时间
因为 Cronjob 实际上是通过 controller 去管理的，所以其时间是 kube-controller-manager 的时间。
2. 命名
Cronjob 的命名要遵循 DNS subdomain name，并且不能超过 52 个字符。因为 Cronjob Controller 会在其创建的 Job 后再拼接 11 个字符 （ K8s 对 Job 命名的限制是 63 个字符）
3. 幂等性
根据配置的重启和健康规则的不同，K8s 启动 Cronjob 时只能保证 about 一次，有时可能会启动多次，有时可能会没有启动，所以需要 cronjob 保证幂等性。
以下是 cronjob 可能会发生的两种异常情况：
  1. 触发多次
concurrencyPolicy 配置为 Allow，并且 startingDeadlineSeconds 不设置或者设置为很大。这样，controller 在多次轮询中可能都会查看到 cronjob 符合再次运行的条件，从而创建多个 job。
  2. 触发0次
concurrencyPolicy 配置为 Forbid，这样 controller 就会等到上一次cronjob结束之后才会进行下一次调度。
4. 自定义 Crontroller
从 kubernetes 1.20 开始支持
5. 删除运行成功的 Job
配置 https://kubernetes.io/docs/tasks/job/automated-tasks-with-cron-jobs/
  successfulJobsHistoryLimit: 0
  failedJobsHistoryLimit: 0

