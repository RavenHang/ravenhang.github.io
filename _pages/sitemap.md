---
layout: archive
published: true
title: "网站地图"
permalink: /sitemap/
author_profile: false
---

{% include base_path %}

这里列出网站的公开页面，也提供供搜索引擎使用的 [XML 网站地图]({{ base_path }}/sitemap.xml)。

<h2>页面</h2>
{% for post in site.pages %}
  {% include archive-single.html %}
{% endfor %}

<h2>文章</h2>
{% for post in site.posts %}
  {% include archive-single.html %}
{% endfor %}

{% capture written_label %}'None'{% endcapture %}

{% for collection in site.collections %}
{% unless collection.output == false or collection.label == "posts" %}
  {% capture label %}{{ collection.label }}{% endcapture %}
  {% if label != written_label %}
  <h2>{{ label }}</h2>
  {% capture written_label %}{{ label }}{% endcapture %}
  {% endif %}
{% endunless %}
{% for post in collection.docs %}
  {% unless collection.output == false or collection.label == "posts" %}
  {% include archive-single.html %}
  {% endunless %}
{% endfor %}
{% endfor %}
