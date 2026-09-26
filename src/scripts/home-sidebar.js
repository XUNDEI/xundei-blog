// 首页侧栏脚本：日历渲染/翻月（数据来自构建期注入的 window.__SIDEBAR_POSTS_BY_DATE）
// + 标签云点击桥接主脚本的 window.xundeiFilterByTag。
// [v2] 数据原本在构建期内联进本脚本，重构后改为页面先行输出 window.__SIDEBAR_POSTS_BY_DATE。
(function () {
  var POSTS_BY_DATE = window.__SIDEBAR_POSTS_BY_DATE || {};
  var MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  var now = new Date();
  var state = { y: now.getFullYear(), m: now.getMonth() };
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function renderCalendar() {
    var daysEl = document.getElementById('sidebar-cal-days');
    var titleEl = document.getElementById('sidebar-cal-title');
    if (!daysEl || !titleEl) return;
    var firstDay = new Date(state.y, state.m, 1).getDay();
    var daysInMonth = new Date(state.y, state.m + 1, 0).getDate();
    titleEl.textContent = state.y + '年' + MONTH_NAMES[state.m];
    var todayStr = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
    var html = '';
    for (var i = 0; i < firstDay; i++) html += '<div class="day-cell empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = state.y + '-' + pad2(state.m + 1) + '-' + pad2(d);
      var cls = 'day-cell';
      if (dateStr === todayStr) cls += ' today';
      var post = POSTS_BY_DATE[dateStr];
      if (post) {
        cls += ' selected';
        html += '<div class="' + cls + '" data-href="' + escapeAttr(post.u) + '" title="' + escapeAttr(post.t) + '">' + d + '</div>';
      } else {
        html += '<div class="' + cls + '">' + d + '</div>';
      }
    }
    daysEl.innerHTML = html;
    var dayLinks = daysEl.querySelectorAll('.day-cell[data-href]');
    for (var j = 0; j < dayLinks.length; j++) {
      dayLinks[j].addEventListener("click", function () {
        window.location.href = this.getAttribute("data-href");
      });
    }
  }
  function shiftMonth(dir) {
    state.m += dir;
    if (state.m < 0) { state.m = 11; state.y--; }
    if (state.m > 11) { state.m = 0; state.y++; }
    renderCalendar();
  }
  function initSidebar() {
    var prevBtn = document.getElementById('sidebar-cal-prev');
    var nextBtn = document.getElementById('sidebar-cal-next');
    if (prevBtn) prevBtn.addEventListener("click", function (e) { e.preventDefault(); shiftMonth(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function (e) { e.preventDefault(); shiftMonth(1); });
    renderCalendar();
    var tagLinks = document.querySelectorAll('.sidebar-tag[data-tag]');
    for (var k = 0; k < tagLinks.length; k++) {
      tagLinks[k].addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tag = this.getAttribute("data-tag");
        var wasActive = this.classList.contains("tag-active");
        var actives = document.querySelectorAll('.sidebar-tag.tag-active');
        for (var q = 0; q < actives.length; q++) actives[q].classList.remove("tag-active");
        if (!wasActive) this.classList.add("tag-active");
        if (typeof window.xundeiFilterByTag === "function") window.xundeiFilterByTag(tag);
      });
    }
  }
  initSidebar();
})();
