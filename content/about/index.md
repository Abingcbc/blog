---
title: "About"
type: about
showDate: false
showReadingTime: false
showAuthor: false
showTableOfContents: false
showWordCount: false
showComments: false
sections:
  - block: about.avatar
    content:
      # title: Bingchang Chen
      username: admin
  - block: experience
    content:
      title: Eduation
      # Date format for experience
      #   Refer to https://wowchemy.com/docs/customization/#date-format
      date_format: Jan 2006
      # Experiences.
      #   Add/remove as many `experience` items below as you like.
      #   Required fields are `title`, `company`, and `date_start`.
      #   Leave `date_end` empty if it's your current employer.
      #   Begin multi-line descriptions with YAML's `|2-` multi-line prefix.
      items:
        - title: M.Eng in AI and Data Design
          company: Tongji University
          company_logo: Tongji
          location: Shanghai
          date_start: '2021-09-01'
          date_end: '2024-04-01'
        - title: B.Eng in Software Engineering
          company: Tongji University
          company_logo: Tongji
          location: Shanghai
          date_start: '2017-09-01'
          date_end: '2021-07-01'
    design:
      columns: '1'
  - block: experience
    content:
      title: Experience
      date_format: Jan 2006
      items:
        - title: SDE Intern
          company: Alibaba Cloud, SLS (Simple Log Service)
          company_logo: aliyun
          location: Shanghai
          date_start: '2023-06-01'
          date_end: '2023-09-01'
        - title: SDE Intern
          company: Huawei Cloud, Data Innovation Lab
          company_logo: huawei
          location: Hangzhou
          date_start: '2022-07-01'
          date_end: '2022-10-01'
        - title: SDE Intern
          company: ByteDance, AML (Applied Machine Learning)
          company_logo: ByteDance
          location: Shanghai
          date_start: '2020-09-01'
          date_end: '2021-07-01'
        - title: SDE Intern
          company: Alibaba, Dataphin
          company_logo: alibaba
          location: Hangzhou
          date_start: '2020-06-01'
          date_end: '2021-08-01'
        - title: SDE Intern
          company: Minghong Quant, AI Platform
          company_logo: minghong
          location: Shanghai
          date_start: '2020-06-01'
          date_end: '2021-08-01'
        - title: SDE Intern
          company: Wizard Quant, AI Platform
          company_logo: wizard
          location: Shanghai
          date_start: '2020-06-01'
          date_end: '2021-08-01'
    design:
      columns: '1'
  - block: collection
    id: featured
    content:
      title: Publications
      filters:
        folders:
          - publication
      archive:
        enable: false
    design:
      columns: '1'
      view: card
---
<!-- ### 正在寻找2024届校招岗位 ❤️
<hr>

本科就读于同济大学软件学院，目前硕士就读于同济大学设计与创意学院人工智能与数据设计专业 <a href="https://idvxlab.com">IDvX 实验室</a>。

## 实习经历：
* 阿里云日志服务，后端研发实习生
* 宽德投资，AI平台开发实习生
* 华为云，算法研发实习生
* 字节跳动，后端研发实习生
* 阿里巴巴，后端研发实习生

## 开源经历：
* iLogtail
* Sealos
* Casddor
* Casbin
* TiKV
