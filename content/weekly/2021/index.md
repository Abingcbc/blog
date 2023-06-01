---
title: 2021 年终总结 —— 翻天覆地
date: 2022-06-01 00:19:16
---
2021年这一年的时间里，发生了太多的事，如果不写下来的话，在脑海中只会有一些模糊的印象，不清楚自己取得了哪些成绩，又有哪里不尽人意，同时也可以从一个旁观者的视角，来观察自己这一年有没有虚度光阴。所以，就从2021年开始，开始每年对过去的一年进行一个记录吧~
## 技术
### K8s
在年初的时候，阅读了《Kubernetes in Action》这本书，受益匪浅，再加上实习中的实践，对 K8s 的了解更加深入了。K8s 作为目前 Cloud 的实际代名词，在应用开发中已经是无法替代的存在了。作为云原生的基础设施，对于 K8s 的学习，除了掌握其基础的操作，例如 Deployment、Ingress 等等组件的使用，来满足上层的应用开发以外，对于 K8s 本身的学习，也是十分重要的。因为 K8s 本身就是一个庞大复杂的系统，而且经过无数业界大佬的打磨，系统上的设计无疑是很多问题的 best practice。深入理解 K8s 的设计，对于未来设计自己的应用架构肯定会带来很大的帮助。
### 自动化部署
我在实习期间负责的主要的一部分内容就是自动化部署。随着现在微服务化的趋势以及系统内第三方依赖组件的数量的增加，部署其实是一个非常麻烦的问题。在公有云的场景下，部分第三方组件或许可以通过外部服务的形式解决。但在私有云的情况下，部署需要同时部署这些第三方组件，无疑给部署增加了很大的复杂度。不仅仅如此，对于任何现代化的软件来说，部署都是需要进行标准化的。通过部署文档，类似手工作坊进行的部署方式，是无法持久的，人因的错误是整个部署过程中很大的不稳定因素。这方面也有很多做的比较好的开源项目，比如说 TiDB 的 TiUP 等等。
### 可视化
实话说，在正式进入硕士学习之前，我对于可视化的了解可能都比较浅薄（虽然明知道这是自己硕士的研究方向）。在听完大老板的课之后，对于这个领域有了全新的认知。可视化这个领域虽然很小，但并不是像大众认为的只有简单的图表而已。首先，图表本身的设计有着很多问题值得研究。设计可能是一个主观感性的行为，但我大老板的想法是通过design space等方式，将其转化为理性，有逻辑的行为。我对这一点非常认同，给了我一种茅塞顿开的感觉，让我对之前很多看似感性的事情有了新的理解。其次，可视分析也是可视化中非常重要的一部分。很多问题，通过可视化的形式，就可以很清楚和容易地被分析出来。这一类系统，感觉在 BI 领域应该有很大的发展空间。
### Casbin
一直以来想加入一个开源社区，为 developer 们做出一点点自己的贡献。于是通过一个活动加入到了 Casbin社区。Casbin 是一个权限校验框架，通过 well-defined 的 model 结构，支持对各种类型的校验模式（比如RBAC，ABAC等等）。除此之外，我觉得 Casbin 能够获得 10k+ star 的另一个原因是他的生态支持也太丰富了。各种语言，各种前端后端框架，各种数据库，只要是有需求，都会进行支持。其中另一个最重要的应该是 Casdoor，一个第三方统一身份认证框架，与 KeyCloak 相对标。

这两个项目都非常有意义，Casbin 主要是像一个解析器一样，面对不同的 model 和 policy定义，需要提供正确的校验结果，我个人还挺喜欢慢慢推理，寻找哪一步解析错误的过程。而 Casdoor 则像一个业务系统，如何实现更多的 feature，如何提升易用性，与更多的第三方系统进行集成。
### Other
除此之前，这一年间也多多少少接触了很多其他技术。实习的时候无所事事，开始写起来了 Augular，体验了一次像 Java 一样的前端的开发模式；暑假的时候参加 GSoC，借机接触了一下 Rust，对这门语言产生了深深的敬畏，但可惜没能深入学习下去；开学以后接触了很多设计领域的coding，做了一些数字媒体类似的课程作业......
## 生活
上半年实习的过程中，感觉自己逐渐放开了。在实习期间遇到了很多伙伴，大家一起快乐摸鱼，真的是度过了一段很快乐的时光。最重要的是毕业啦！最高学历终于从高中变成了本科。虽然毕业旅行因为疫情原因没能成行，但暑假在家快乐摸鱼，疯狂锻炼猎龙技术，还差一点把塞尔达的呀哈哈全收集，也算快乐的度过了最后一个暑假了。

如果说上半年是我人生最快乐的时光，那么下半年开学后，就是我目前为止最痛苦的日子了。但无论是前后哪个阶段，我其实都成长了非常多，也算是值得庆幸的事，能够在接受到社会正式的毒打之前，提前成长。

一方面的压力来自于课程，毕竟我是属于跨专业保研到了设创，难免在研究生阶段要接触到设计相关的课程。在组队上，天真地以为老师是技术背景出身的，项目可能也会是，结果就是在课程项目上被设计背景的同学吊打。在 DDL 前疯狂爆肝，但是也换不来特别高的成绩。研究生课程中没能抱上设计大佬们的大腿，没体验一次被带飞的感觉，算是比较可惜的了。

另一方面最大的压力来自于实验室。大老板的痛骂确实是有效的。做事不够深入的问题，在我之前的面试以及实习过程中，都多次被前辈们提到过，但都采用相对和蔼的语气和态度。我也是属实有点抖m了，这种不痛不痒的批评根本不往心里去，也没有发自内心地去纠正自己的问题，非要等到现在的大老板爆骂自己，自己才意识到问题。。。

年末到22年初的状态确实不太好，似乎每年的这段时间都很emo。在年底DDL结束之后，自己的节奏一时间也没调整过来。闲下来以后，脑子昏昏沉沉，没了目标，搞不清楚自己真正想要什么，不讨人喜欢。最后也算造成了不可弥补的错误吧，非常可惜。不过，人各有命吧，也学习到了很多，前后相比，算是成熟了很多了。

拖拖拉拉，写完这篇总结的时候，2022年都已经过去四分之一了。总的来说，2022年可以用“翻天覆地”这个词来概括，在这个痛苦的过程中，也见到了一个不一样的自己。虽然2022年的开端不算顺利，很失败，但这些问题就留到明年的总结中来写吧。最后，希望在2023年总结今年的时候，可以用一个更加开心的关键词吧。