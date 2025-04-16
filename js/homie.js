    var intervals = {}; // Object to keep track of intervals
    var activeEventId = null; // Track the currently active event
    const fallbackURL = "https://bikinbaru96.blogspot.com/2024/06/blog-post_13.html"; // URL fallback jika URL tidak ditemukan

function isMobileDevice() {
    return /Mobi|Android/i.test(navigator.userAgent);
}

function setupEvents() {
    var eventContainers = document.querySelectorAll('.event-container');
    var validEventIds = [];

    eventContainers.forEach(function(container) {
        var id = container.getAttribute('data-id');
        validEventIds.push(id);

        // Event time (match-date and match-time)
        var matchDate = container.querySelector('.match-date').textContent.trim();
        var matchTime = container.querySelector('.match-time').textContent.trim();
        var eventTime = parseEventDateTime(matchDate, matchTime);

        // Kickoff event time (kickoff-match-date and kickoff-match-time)
        var kickoffDate = container.querySelector('.kickoff-match-date').textContent.trim();
        var kickoffTime = container.querySelector('.kickoff-match-time').textContent.trim();
        var kickoffEventTime = parseEventDateTime(kickoffDate, kickoffTime);

        var eventDurationHours = parseFloat(container.getAttribute('data-duration')) || 3.5;
        var eventDurationMilliseconds = eventDurationHours * 60 * 60 * 1000;

        // Update match times for both eventTime and kickoffEventTime
        updateMatchTimes(container, eventTime); // Original event time
        updateMatchTimes(container, kickoffEventTime); // Kickoff time adjustment

        // Check live status using eventTime
        checkLiveStatus(container, eventTime, eventDurationMilliseconds);

        // Check stored event status
        var storedStatus = sessionStorage.getItem(`eventStatus_${id}`);
        if (storedStatus === 'ended') {
            markEventAsEnded(id); // Set event as ended if stored status is "ended"
            if (activeEventId === id) {
                redirectToEndedURL();
            }
        }

        // Setup server buttons
        var servers = JSON.parse(container.getAttribute('data-servers'));
        var buttonsContainer = container.querySelector('.buttons-container');

        buttonsContainer.innerHTML = ''; // Clear existing buttons

        servers.forEach(function(server, index) {
            if (server.label.includes("Mobile") && !isMobileDevice()) {
                return;
            }

            var button = document.createElement('div');
            button.className = 'server-button';
            button.textContent = server.label;
            button.setAttribute('data-url', server.url);
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                selectServerButton(button);
                loadEventVideo(container, server.url);
            });
            buttonsContainer.appendChild(button);

            if (index === 0) {
                button.classList.add('active');
            }
        });

        // Add event listener to toggle server buttons on click
        container.addEventListener('click', function() {
            var now = new Date();
            if (now >= eventTime) {
                toggleServerButtons(container, true);
            }
            loadEventVideo(container); // Ensure the event is loaded when container is clicked
        });

        // Restore active button state from sessionStorage
        var storedActiveEventId = sessionStorage.getItem('activeEventId');
        var storedActiveServerUrl = sessionStorage.getItem(`activeServerUrl_${id}`);
        if (storedActiveEventId === id && storedActiveServerUrl) {
            var storedButton = container.querySelector(`.server-button[data-url="${storedActiveServerUrl}"]`);
            if (storedButton) {
                selectServerButton(storedButton);
                loadEventVideo(container, storedActiveServerUrl, false);
            }
        }
    });

    // Check if the active event is still valid, otherwise reset it
    if (activeEventId && !validEventIds.includes(activeEventId)) {
        redirectToEndedURL();
    }

    // Start periodic check for event statuses
    startPeriodicEventCheck();
}

    function parseEventDateTime(date, time) {
        // Assuming date format is "June 21, 2024" and time is "07:30"
        var formattedDate = new Date(`${date}T${time}:00+07:00`);
        return formattedDate;
    }

    function updateCountdown(countdownElement, countdownTimer, eventTime, url, id) {
        clearInterval(intervals[id]); // Clear previous interval if exists

        var interval = setInterval(function() {
            var now = new Date().getTime();
            var distance = eventTime.getTime() - now;

            if (distance < 1000) { // Clear the video src just before the countdown ends
                var videoIframe = document.getElementById('video-iframe');
                if (videoIframe) {
                    videoIframe.src = '';
                }
            }

            if (distance < 0) {
                clearInterval(interval);
                countdownElement.style.display = 'none';
                console.log('Event started:', id);
                loadEventVideo(document.querySelector(`.event-container[data-id="${id}"]`), url, false); // Load video with the initial URL
                checkLiveStatus(document.querySelector(`.event-container[data-id="${id}"]`), eventTime); // Show live label

                // Mark the first button as active
                var firstButton = document.querySelector(`.event-container[data-id="${id}"] .server-button`);
                if (firstButton) {
                    selectServerButton(firstButton);
                }

                // Set timeout to check if event should end after its duration
                var eventDurationMilliseconds = parseFloat(document.querySelector(`.event-container[data-id="${id}"]`).getAttribute('data-duration')) * 60 * 60 * 1000 || 3.5 * 60 * 60 * 1000;
                var eventEndTime = new Date(eventTime.getTime() + eventDurationMilliseconds);
                setTimeout(function() {
                    var now = new Date();
                    if (now >= eventEndTime) {
                        if (activeEventId === id) {
                            markEventAsEnded(id);
                            redirectToEndedURL();
                        }
                    }
                }, eventDurationMilliseconds);
            } else {
                var days = Math.floor(distance / (1000 * 60 * 60 * 24));
                var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                var seconds = Math.floor((distance % (1000 * 60)) / 1000);

                countdownElement.style.display = 'block'; // Ensure countdown element is displayed
                countdownTimer.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s `;
                console.log(`Countdown for event ${id}: ${days}d ${hours}h ${minutes}m ${seconds}s`);
            }
        }, 1000);

        intervals[id] = interval; // Store the interval in the intervals object
    }

function updateMatchTimes(container, eventStartTime) {
    var matchDateElem = container.querySelector('.match-date');
    var matchTimeElem = container.querySelector('.match-time');
    var kickoffDateElem = container.querySelector('.kickoff-match-date');
    var kickoffTimeElem = container.querySelector('.kickoff-match-time');

    if (!matchDateElem.hasAttribute('data-original-date')) {
        matchDateElem.setAttribute('data-original-date', matchDateElem.textContent.trim());
        matchTimeElem.setAttribute('data-original-time', matchTimeElem.textContent.trim());
    }

    var utcDate = new Date(eventStartTime.getTime() + (eventStartTime.getTimezoneOffset() * 60000));
    var visitorOffsetInMinutes = new Date().getTimezoneOffset();
    var visitorOffsetInHours = visitorOffsetInMinutes / 60;
    var localEventStartTime = new Date(utcDate.getTime() - (visitorOffsetInHours * 60 * 60 * 1000));

    var adjustedDate = localEventStartTime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var adjustedTime = localEventStartTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    console.log(`Adjusted date for event: ${adjustedDate}`);
    console.log(`Adjusted time for event: ${adjustedTime}`);

    // Update match date and time
    matchDateElem.textContent = adjustedDate;
    matchTimeElem.textContent = adjustedTime;

    // Update kickoff date and time if available
    if (kickoffDateElem && kickoffTimeElem) {
        kickoffDateElem.textContent = adjustedDate;
        kickoffTimeElem.textContent = adjustedTime;
    }
}
    function checkLiveStatus(container, eventStartTime, eventDurationMilliseconds) {
        var now = new Date();
        var liveLabel = container.querySelector('.live-label');

        if (now >= eventStartTime) {
            liveLabel.style.display = 'block';
            console.log('Event live:', container.getAttribute('data-id'));

            // Set timeout untuk menyembunyikan event container saat event berakhir
            var eventEndTime = new Date(eventStartTime.getTime() + eventDurationMilliseconds);
            setTimeout(function() {
                var now = new Date();
                if (now >= eventEndTime) {
                    markEventAsEnded(container.getAttribute('data-id')); // Sembunyikan event-container saat event berakhir
                }
            }, eventEndTime.getTime() - now);
        } else {
            liveLabel.style.display = 'none';
            console.log('Event not live yet:', container.getAttribute('data-id'));

            // Set timeout untuk mengecek status live lagi saat event dimulai
            setTimeout(function() {
                checkLiveStatus(container, eventStartTime, eventDurationMilliseconds);
            }, eventStartTime.getTime() - now);
        }
    }

    function setupChannels() {
        var channelContainers = document.querySelectorAll('.channel-container');

        // Ambil ID elemen yang sebelumnya dipilih dari sessionStorage
        var activeChannelId = sessionStorage.getItem('activeChannelId');

        channelContainers.forEach(function(container) {
            var channelId = container.getAttribute('data-id'); // Pastikan elemen punya atribut unik, misalnya "data-id"

            // Jika elemen ini adalah yang terakhir dipilih, tambahkan kelas .selected
            if (channelId === activeChannelId) {
                container.classList.add('selected');
                // Gunakan loadEventVideo untuk memuat ulang video dari channel-container
                loadEventVideo(container); // Muat ulang video dengan fungsi loadEventVideo
            }

            // Tambahkan event listener untuk klik
            container.addEventListener('click', function() {
                // Hapus kelas .selected dari semua elemen lain
                channelContainers.forEach(function(otherContainer) {
                    otherContainer.classList.remove('selected');
                });

                // Tambahkan kelas .selected ke elemen yang diklik
                container.classList.add('selected');

                // Simpan ID elemen yang sedang dipilih ke sessionStorage
                sessionStorage.setItem('activeChannelId', channelId);

                // Load video menggunakan loadEventVideo
                loadEventVideo(container); // Panggil loadEventVideo untuk memuat video channel
            });
        });
    }

    // Variabel global untuk Clappr Player instance, timeout reconnect, dan cache URL
    var clapprPlayerInstance = null;
    var reconnectTimeout = null;
    var lastLoadedUrl = null;  // Cache URL terakhir yang dimuat

    function normalizeUrl(url) {
        try {
            let urlObj = new URL(url);
            // Hapus trailing slash, tetapi tetap simpan query string jika ada
            let normalizedUrl = urlObj.origin + urlObj.pathname + urlObj.search;
            return normalizedUrl;
        } catch (e) {
            console.error("Invalid URL:", url);
            return url; // Kembalikan URL asli jika tidak bisa diparsing
        }
    }

    function loadEventVideo(container, specificUrl = null, resetActiveId = true) {
        var id = container.getAttribute('data-id'); // Mendapatkan data-id
        var storedUrl = sessionStorage.getItem(`activeServerUrl_${id}`); // Ambil URL dari sessionStorage tanpa mendekripsi
        var url = specificUrl || storedUrl || container.getAttribute('data-url') || fallbackURL;
        var isChannel = container.classList.contains('channel-container'); // Deteksi apakah ini channel-container

        var matchDate = container.querySelector('.match-date')?.getAttribute('data-original-date');
        var matchTime = container.querySelector('.match-time')?.getAttribute('data-original-time');
        var eventDurationHours = parseFloat(container.getAttribute('data-duration')) || 3.5;
        var eventDurationMilliseconds = eventDurationHours * 60 * 60 * 1000;

        var eventStartTime = parseEventDateTime(matchDate, matchTime);
        var now = new Date();

        if (isNaN(eventStartTime.getTime()) && !isChannel) {
            console.error(`Invalid event time for event ${id}: ${matchDate} ${matchTime}`);
            return;
        }

        if (resetActiveId) {
            activeEventId = id; // Set the active event ID
            sessionStorage.setItem('activeEventId', id); // Save active event ID to session storage
        }

        var countdownElement = document.getElementById('countdown');
        var countdownTimer = countdownElement.querySelector('.countdown-timer');
        var videoIframe = document.getElementById('video-iframe');
        var videoPlaceholder = document.getElementById('video-placeholder');
        var playerElement = document.getElementById("player");

        // Set sandbox attributes before loading the URL
        var decryptedUrl = decryptUrl(url); // Dekripsi hanya pada variabel baru sebelum digunakan
        if (decryptedUrl.includes('sportsonline') || decryptedUrl.includes('sportcastelite') || decryptedUrl.includes('venoms') || decryptedUrl.includes('p2plive2')) {
            videoIframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-top-navigation');
        } else {
            videoIframe.removeAttribute('sandbox');
        }

        // Hide all countdowns and clear all intervals
        document.querySelectorAll('.countdown-wrapper').forEach(function(countdown) {
            countdown.style.display = 'none';
        });
        for (var key in intervals) {
            clearInterval(intervals[key]);
        }

        // Hide buttons for other events
        document.querySelectorAll('.event-container .server-buttons').forEach(function(buttonsContainer) {
            buttonsContainer.style.display = 'none';
        });

        // Jika ini channel-container (menggunakan iframe langsung)
        if (isChannel) {
            // Hentikan dan kosongkan Clappr Player jika masih aktif
            if (clapprPlayerInstance) {
                clapprPlayerInstance.destroy(); // Hancurkan Clappr Player
                clapprPlayerInstance = null; // Reset Clappr instance setelah dihancurkan
                lastLoadedUrl = null; // Reset URL terakhir yang dimuat
            }

            // Set URL iframe jika berbeda
            if (videoIframe.src !== decryptedUrl) {
                videoIframe.src = decryptedUrl; // Set URL iframe
            }
            videoIframe.style.display = 'block'; // Tampilkan iframe
            videoPlaceholder.style.display = 'none'; // Sembunyikan placeholder
            playerElement.style.display = 'none'; // Sembunyikan Clappr Player
            console.log('Channel video loaded:', decryptedUrl);
            return; // Tidak melanjutkan logika event-container
        }

        // Jika URL adalah m3u8, gunakan Clappr Player
        if (now >= eventStartTime) {
            countdownElement.style.display = 'none';

            // Hentikan dan kosongkan iframe jika berpindah dari URL iframe ke URL lain
            if (videoIframe && videoIframe.src !== decryptedUrl) {
                videoIframe.src = ''; // Kosongkan src iframe untuk menghentikan pemutaran video
                videoIframe.style.display = 'none'; // Sembunyikan iframe
            }

            if (decryptedUrl.includes(".m3u8")) {
                let normalizedUrl = normalizeUrl(decryptedUrl);

                // Jika Clappr player sudah ada dan tidak perlu diinisialisasi ulang
                if (clapprPlayerInstance && lastLoadedUrl === normalizedUrl) {
                    console.log('Clappr sudah ada, sembunyikan video-placeholder dan tampilkan player');
                    videoPlaceholder.style.display = 'none'; // Sembunyikan placeholder
                    playerElement.style.display = 'block'; // Pastikan player tetap tampil
                } else {
                    // Jika Clappr player sudah ada, tetapi URL berbeda, maka kita hancurkan dan inisialisasi ulang
                    if (clapprPlayerInstance) {
                        // Bersihkan event listeners dan pending reconnects
                        clapprPlayerInstance.off(Clappr.Events.PLAYER_ERROR);
                        clapprPlayerInstance.off(Clappr.Events.PLAYER_STOP);
                        clearTimeout(reconnectTimeout);
                        clapprPlayerInstance.destroy(); // Hancurkan player jika URL berbeda
                        clapprPlayerInstance = null; // Reset instance setelah dihancurkan
                    }

                    videoPlaceholder.style.display = 'none'; // Sembunyikan placeholder
                    playerElement.style.display = 'block'; // Tampilkan Clappr Player

                    // Inisialisasi Clappr Player
                    clapprPlayerInstance = new Clappr.Player({
                        source: normalizedUrl,
                        height: '100%',
                        width: '100%',
                        loop: 'true',
                        poster: 'https://kltraid.pages.dev/images/poster.png',
                        plugins: [LevelSelector],
                        mediacontrol: {
                            seekbar: '#014AFF',
                            buttons: '#FFF'
                        },
                        playback: {
                            hlsjsConfig: {
                                startPosition: -1, // Selalu mulai dari posisi live terkini
                            }
                        },
                        mimeType: "application/x-mpegURL"
                    });

                    clapprPlayerInstance.attachTo(playerElement); // Attach Clappr ke playerElement
                    lastLoadedUrl = normalizedUrl; // Simpan URL terakhir yang dimuat

                    // Force landscape on fullscreen
                    clapprPlayerInstance.on(Clappr.Events.PLAYER_FULLSCREEN, function() {
                        if (screen.orientation && screen.orientation.lock) {
                            screen.orientation.lock('landscape').catch(function(error) {
                                console.error('Failed to lock screen orientation:', error);
                            });
                        }
                    });

                    // Unlock orientation on exit fullscreen
                    clapprPlayerInstance.on(Clappr.Events.PLAYER_EXIT_FULLSCREEN, function() {
                        if (screen.orientation && screen.orientation.unlock) {
                            screen.orientation.unlock();
                        }
                    });

                    // Auto-reconnect on error
                    clapprPlayerInstance.on(Clappr.Events.PLAYER_ERROR, function() {
                        console.log('Error occurred, attempting to reconnect...');
                        clearTimeout(reconnectTimeout); // Clear any pending reconnects
                        reconnectTimeout = setTimeout(function() {
                            if (clapprPlayerInstance && clapprPlayerInstance.options.source === normalizedUrl) {
                                clapprPlayerInstance.load({source: normalizedUrl});
                                clapprPlayerInstance.play();
                            }
                        }, 5000); // Coba lagi dalam 5 detik
                    });

                    // Auto-play after stop
                    clapprPlayerInstance.on(Clappr.Events.PLAYER_STOP, function() {
                        if (!clapprPlayerInstance.isPaused()) {
                            console.log('Stream stopped, trying to reconnect');
                            clapprPlayerInstance.play(); // Auto-reconnect jika stream berhenti
                        }
                    });

                    // Auto resize player
                    function resizePlayer() {
                        requestAnimationFrame(() => {
                            var newWidth = playerElement.parentElement.offsetWidth;
                            var newHeight = playerElement.parentElement.offsetHeight;
                            clapprPlayerInstance.resize({ width: newWidth, height: newHeight });
                        });
                    }
                    resizePlayer();
                    window.onresize = resizePlayer;
                }

            } else {
                // Untuk URL lain (bukan m3u8), gunakan iframe biasa
                playerElement.style.display = 'none'; // Sembunyikan Clappr Player
                if (clapprPlayerInstance) {
                    clapprPlayerInstance.destroy(); // Hancurkan Clappr Player jika masih ada
                    clapprPlayerInstance = null; // Reset instance setelah dihancurkan
                    lastLoadedUrl = null; // Reset URL yang terakhir dimuat
                }
                if (videoIframe.src !== decryptedUrl) { // Hanya update src jika berbeda
                    videoIframe.src = decryptedUrl; // Load URL untuk iframe
                }
                videoIframe.style.display = 'block'; // Tampilkan iframe
                videoPlaceholder.style.display = 'none'; // Sembunyikan placeholder
            }

            setActiveHoverEffect(id);  // Fungsi untuk mengatur efek hover berdasarkan id
            console.log('Loading event video now:', id);
            toggleServerButtons(container, true); // Tampilkan tombol server
            checkLiveStatus(container, eventStartTime, eventDurationMilliseconds); // Show live label

            // Mark the correct button as active if not already marked
            var activeButton = container.querySelector(`.server-button[data-url="${url}"]`);
            if (activeButton) {
                selectServerButton(activeButton);
            }
        } else {
            // Jika event belum dimulai, tampilkan video-placeholder tanpa menghancurkan Clappr player
            countdownElement.style.display = 'block';
            videoIframe.style.display = 'none';
            videoPlaceholder.style.display = 'block'; // Pastikan placeholder tampil di atas Clappr
            playerElement.style.display = 'none'; // Sembunyikan Clappr player sementara waktu
            updateCountdown(countdownElement, countdownTimer, eventStartTime, url, id);
            setActiveHoverEffect(id); // Set hover effect when event is selected
            console.log('Setting countdown for future event:', id);
        }

        // Tampilkan tombol server untuk event yang aktif
        toggleServerButtons(container, now >= eventStartTime);

        // Simpan URL server yang aktif di sessionStorage
        if (resetActiveId && specificUrl) {
            sessionStorage.setItem(`activeServerUrl_${id}`, specificUrl);
        }
    }

    function markEventAsEnded(eventId) {
        var eventContainer = document.querySelector(`.event-container[data-id="${eventId}"]`);
        if (eventContainer) {
            sessionStorage.setItem(`eventStatus_${eventId}`, 'ended'); // Simpan status "Ended" di sessionStorage
            eventContainer.style.display = 'none'; // Sembunyikan event container ketika event berakhir
        }
    }

    function redirectToEndedURL() {
        var storedActiveEventId = sessionStorage.getItem('activeEventId');
        var storedStatus = sessionStorage.getItem(`eventStatus_${storedActiveEventId}`);

        if (storedStatus === 'ended') {
            // Jika event sudah berakhir, sembunyikan event-container aktif
            var activeEventContainer = document.querySelector(`.event-container[data-id="${storedActiveEventId}"]`);
            if (activeEventContainer) {
                activeEventContainer.style.display = 'none'; // Sembunyikan event container
            }
        }
    }

    function setActiveHoverEffect(activeId) {
        // Menghapus class hover-effect dari semua containers
        document.querySelectorAll('.event-container').forEach(function(container) {
            container.classList.remove('hover-effect');
        });

        // Menambahkan class hover-effect hanya pada container dengan id yang aktif
        var activeContainer = document.querySelector('.event-container[data-id="' + activeId + '"]');
        if (activeContainer) {
            activeContainer.classList.add('hover-effect');
            console.log('Hover effect set for event:', activeId);
        }
    }

    function resetHoverEffect() {
        if (activeEventId) {
            var activeContainer = document.querySelector('.event-container[data-id="' + activeEventId + '"]');
            if (activeContainer) {
                activeContainer.classList.add('hover-effect');
                console.log('Hover effect reset for active event:', activeEventId);
            }
        }
    }

    function toggleServerButtons(container, show = true) {
        var serverButtonsContainer = container.querySelector('.server-buttons');
        if (show) {
            serverButtonsContainer.style.display = 'flex';
        } else {
            serverButtonsContainer.style.display = 'none';
        }
    }
