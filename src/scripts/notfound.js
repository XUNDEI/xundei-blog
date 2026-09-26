
        // ===== 壁纸加载逻辑（仅从 wallpaper.json） =====
        (function() {
            var auroraBg = document.getElementById('aurora-bg');

            function hideAuroraBackground() {
                if (!auroraBg || auroraBg.classList.contains('hidden')) return;
                                auroraBg.classList.add('fade-out');
                setTimeout(function() {
                    auroraBg.classList.add('hidden');
                    auroraBg.style.display = 'none';
                }, 1200);
            }

            // 加载壁纸（仅从 wallpaper.json）
            function loadWallpaperFromConfig() {
                return new Promise(function(resolve) {
                    fetch('/wallpaper.json')
                        .then(function(response) {
                            if (!response.ok) throw new Error('请求失败');
                            return response.json();
                        })
                        .then(function(data) {
                            if (data && data.length) {
                                var entry = data[Math.floor(Math.random() * data.length)];
                                var imgUrl = entry.path;
                                if (!/^https?:\/\//i.test(imgUrl)) {
                                    imgUrl = './' + imgUrl;
                                }
                                var timestamp = new Date().getTime();
                                imgUrl += (imgUrl.indexOf('?') === -1 ? '?' : '&') + 't=' + timestamp;

                                var img = new Image();
                                img.onload = function() {
                                    document.body.style.backgroundImage = 'url(' + imgUrl + ')';
                                    document.documentElement.classList.add('wallpaper-active');
                                    hideAuroraBackground();
                                    resolve(true);
                                };
                                img.onerror = function() {
                                    resolve(false);
                                };
                                img.src = imgUrl;
                            } else {
                                resolve(false);
                            }
                        })
                        .catch(function() {
                            resolve(false);
                        });
                });
            }

            loadWallpaperFromConfig().then(function(ok) {
                if (!ok) {
                    console.log('壁纸加载失败，保留提亮后的极光背景');
                }
            });
        })();
    