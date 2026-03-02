const firebaseConfig = { databaseURL: "https://jakarta-blog-default-rtdb.firebaseio.com" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let userIP = ""; 
let staticPosts = {};

const openLogin = () => document.getElementById('loginModal').style.display = 'flex';
const openPostModal = () => document.getElementById('postModal').style.display = 'flex';
const closeModal = id => document.getElementById(id).style.display = 'none';

async function getUserIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        userIP = data.ip.replace(/\./g, '_');
    } catch (e) {
        userIP = "unknown_user";
    }
}

function updateVisitorStats() {
    const visitRef = db.ref('stats/visits');
    visitRef.transaction((currentValue) => {
        return (currentValue || 0) + 1;
    });
}
updateVisitorStats();

async function trackVisitor() {
    if(sessionStorage.getItem('admin') === 'true') return;
    try {
        const res = await fetch('https://ipapi.co/json/');
        const ipData = await res.json();
        const logEntry = {
            ip: ipData.ip,
            location: `${ipData.city}, ${ipData.country_name}`,
            agent: navigator.userAgent,
            time: new Date().toLocaleString('ko-KR'),
            timestamp: Date.now()
        };
        firebase.database().ref('visitorLog').push(logEntry);
        firebase.database().ref('stats/visits').transaction(c => (c || 0) + 1);
    } catch (e) {
        firebase.database().ref('visitorLog').push({
            ip: "Private",
            location: "Unknown",
            agent: navigator.userAgent,
            time: new Date().toLocaleString('ko-KR'),
            timestamp: Date.now()
        });
        firebase.database().ref('stats/visits').transaction(c => (c || 0) + 1);
    }
}
trackVisitor();

function setRandomHero() {
    const hero = document.getElementById('mainHero');
    if (!hero) return;
    const randomId = Math.floor(Math.random() * 1000);
    const imageUrl = `https://picsum.photos/1600/900?random=${randomId}`;
    hero.style.backgroundImage = `url('${imageUrl}')`;
}

async function loadPosts() {
 
    const hero = document.getElementById('mainHero');
    if (hero) {
        hero.style.height = '85vh';
        hero.querySelector('.hero-title').innerText = "Wonderful Jakarta";
        hero.querySelector('.hero-subtitle').innerText = "Exploring the vibrant fusion of heritage and high-rise.";
        setRandomHero(); 
    }
    try {
        const response = await fetch('assets/data/posts.json');
        staticPosts = await response.json();
        db.ref('posts').once('value', snap => {
            const dynamicData = snap.val() || {};
            renderPostList(staticPosts, dynamicData);
        });
    } catch (e) {
        console.error("데이터 로딩 실패:", e);
        document.getElementById('postContainer').innerHTML = '<p>Error loading stories.</p>';
    }
}

function renderPostList(staticData, dynamicData) {
    let html = '';
    Object.keys(staticData).reverse().forEach(key => {
        const p = staticData[key];
        const d = dynamicData[key] || {}; 
        const likes = d.likes || 0;
        const commentsCount = d.comments ? Object.keys(d.comments).length : 0;
        const pureDesc = p.desc.replace(/<[^>]*>?/gm, '');
        html += `
        <article class="post-card" onclick="viewPost('${key}')" style="cursor:pointer;">
            <div class="post-image" style="background-image:url('${p.img}')"></div>
            <div class="post-info">
                <span class="post-cat-tag">${p.cat}</span>
                <h3 class="post-list-title">${p.title}</h3>
                <p class="post-list-desc">${pureDesc.substring(0, 130)}...</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; border-top:1px solid rgba(255,255,255,0.05); padding-top:15px;">
                    <small style="color:var(--text-muted); font-size:0.75rem;">${p.date}</small>
                    <div style="font-size:0.8rem; color:var(--primary-batik);">
                        <span style="margin-right:10px;">❤ ${likes}</span>
                        <span>💬 ${commentsCount}</span>
                    </div>
                </div>
            </div>
        </article>`;
    });
    const container = document.getElementById('postContainer');
    container.innerHTML = html || '<p>No stories found.</p>';
    if (window.lucide) lucide.createIcons();
}

let editingCommentId = null; 

function editCommentMode(text, commentId) {
    const input = document.getElementById('commentInput');
    const btn = document.getElementById('commentSubmitBtn');
    input.value = text;
    editingCommentId = commentId; // 현재 수정 중인 댓글 ID 저장
    input.focus();
    btn.innerText = "UPDATE COMMENT";
    btn.style.background = "#e67e22";
    
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteComment(postKey, commentId) {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
        await db.ref(`posts/${postKey}/comments/${commentId}`).remove();
        alert("Comment deleted.");
        viewPost(postKey, true); // 위치 유지하며 갱신
    } catch (e) {
        alert("Delete error: " + e.message);
    }
}

function viewPost(key, isComment = false) {
    const p = staticPosts[key]; 
    if (!p) return;
    db.ref(`posts/${key}`).once('value', snap => {
        const d = snap.val() || {};
        const likes = d.likes || 0;
        const hero = document.getElementById('mainHero');
        
        // 상세 페이지로 들어올 때만 헤더 변경
        if (hero) {
            hero.style.height = '40vh'; 
            hero.querySelector('.hero-title').innerText = p.title;
            hero.querySelector('.hero-subtitle').innerText = `${p.cat} • ${p.date}`;
        }

        let commentsHtml = '';
        if (d.comments) {
            Object.keys(d.comments).forEach(cKey => {
                const c = d.comments[cKey];
                const geoInfo = (c.ip && c.country) ? ` | IP: ${c.ip} (${c.country})` : '';
                const isMyComment = (userIP && c.user === userIP);
                const controlBtns = isMyComment ? `
                    <div style="margin-left:10px; display:inline-flex; gap:5px;">
                        <button onclick="editCommentMode('${c.text.replace(/'/g, "\\'")}', '${cKey}')" style="background:none; border:1px solid var(--primary-batik); color:var(--primary-batik); font-size:10px; padding:2px 5px; cursor:pointer; border-radius:3px;">Edit</button>
                        <button onclick="deleteComment('${key}', '${cKey}')" style="background:none; border:1px solid #ff4757; color:#ff4757; font-size:10px; padding:2px 5px; cursor:pointer; border-radius:3px;">Delete</button>
                    </div>` : '';

                commentsHtml += `
                    <div class="comment-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px 0;">
                        <p class="comment-text" style="margin-bottom: 8px;">${c.text}</p>
                        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 5px; flex-wrap: wrap; align-items:center;">
                            <span>${c.date}</span>
                            <span>${geoInfo}</span>
                            ${controlBtns}
                        </div>
                    </div>`;
            });
        } else {
            commentsHtml = `<p id="noComment" style="color:var(--text-muted);">No comments yet.</p>`;
        }

        // 전체 UI 렌더링
        document.getElementById('postContainer').innerHTML = `
            <div class="post-detail-view" style="animation: fadeInUp 0.5s ease;">
                <button class="btn-text" onclick="loadPosts(); window.scrollTo(0,0);" style="margin-bottom:20px; display:flex; align-items:center; gap:5px; color:var(--primary-batik); background:none; border:none; cursor:pointer; font-weight:bold;">
                    <i data-lucide="arrow-left"></i> Back to List
                </button>
                <img src="${p.img}" style="width:100%; border-radius:15px; margin-bottom:30px; object-fit:cover; max-height:500px; border: 1px solid var(--border);">
                <div class="post-content" style="line-height:1.8; font-size:1.1rem; color:var(--text-main); margin-bottom:40px;">
                    ${p.desc}
                </div>
                <div style="text-align:center; margin-bottom:40px;">
                    <button onclick="handleLike('${key}')" class="btn-like">
                        <i data-lucide="heart"></i> <span id="detailLikeCount">${likes}</span>
                    </button>
<button onclick="loadPosts(); window.scrollTo(0,0);" style="display:inline-flex; align-items:center; gap:8px; padding:12px 24px; background:transparent; border:1px solid var(--primary-batik); color:var(--primary-batik); border-radius:30px; cursor:pointer; font-weight:bold; font-size:0.9rem;">
        <i data-lucide="list"></i> BACK TO LIST
    </button>
                </div>
                <hr style="border:0; border-top:1px solid var(--border); margin:40px 0;">
                <section id="commentSection" class="comment-section"> 
                    <h3 style="font-family:'Playfair Display', serif; color:var(--primary-batik); margin-bottom:20px;">Comments</h3>
                    <div id="commentList" style="margin-bottom:30px;">
                        ${commentsHtml}
                    </div>
                    <div class="comment-form" id="commentFormAnchor" style="background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:20px; border-radius:10px;">
                        <div style="margin-bottom:10px; display:flex; gap:10px; font-size:1.2rem;">
                            <span style="cursor:pointer" onclick="addEmoji('😊')">😊</span>
                            <span style="cursor:pointer" onclick="addEmoji('😍')">😍</span>
                            <span style="cursor:pointer" onclick="addEmoji('👍')">👍</span>
                            <span style="cursor:pointer" onclick="addEmoji('🔥')">🔥</span>
                        </div>
                        <textarea id="commentInput" rows="3" placeholder="Share your thoughts..." style="width:100%; background:transparent; border:none; color:white; outline:none; margin-bottom:10px;"></textarea>
                        <button id="commentSubmitBtn" onclick="addComment('${key}')" class="btn-gold-full" style="width:100%; padding:12px; background:var(--primary-batik); border:none; color:black; font-weight:bold; border-radius:5px; cursor:pointer;">POST COMMENT</button>
                    </div>
                </section>
            </div>
        `;
        
        if (window.lucide) lucide.createIcons();

        // [핵심 수정 부분]
        if (isComment) {
            // 댓글 작성/수정 시에는 해당 위치로 부드럽게 고정만 하고 위로 올리지 않음
            const anchor = document.getElementById('commentSection');
            if(anchor) anchor.scrollIntoView({ behavior: 'auto', block: 'center' });
        } else {
            // 새 포스트를 열 때만 맨 위로 이동
            window.scrollTo(0, 0);
        }
    });
}
function addEmoji(emoji) {
    document.getElementById('commentInput').value += emoji;
}

function handleLike(postKey) {
    const likeRef = db.ref(`posts/${postKey}/likedBy/${userIP}`);
    likeRef.once('value', snap => {
        if (snap.exists()) {
            alert('You already liked this post! ❤️');
        } else {
            db.ref(`posts/${postKey}/likes`).transaction(current => (current || 0) + 1);
            likeRef.set(true);
            const countSpan = document.getElementById('detailLikeCount');
            if(countSpan) countSpan.innerText = parseInt(countSpan.innerText) + 1;
        }
    });
}

// --- 기존 addComment 함수를 아래 내용으로 교체하세요 ---
async function addComment(postKey) {
    const text = document.getElementById('commentInput').value.trim();
    if (!text) return alert('Please enter your comment.');
    
    const btn = document.getElementById('commentSubmitBtn');
    btn.disabled = true;

    try {
        // [추가] 동일 IP 중복 댓글 체크 (수정 모드가 아닐 때만)
        if (!editingCommentId) {
            const snap = await db.ref(`posts/${postKey}/comments`).once('value');
            const existingComments = snap.val();
            if (existingComments) {
                const alreadyPosted = Object.values(existingComments).some(c => c.user === userIP);
                if (alreadyPosted) {
                    alert("You have already left a comment on this post. 🙏");
                    btn.disabled = false;
                    return;
                }
            }
        }

        let displayIp = "0.0.0.0", displayCountry = "Unknown";
        try {
            const res = await fetch('https://ipapi.co/json/');
            const ipData = await res.json();
            displayIp = ipData.ip;
            displayCountry = ipData.country_name;
        } catch (e) { console.error(e); }

        const now = new Date();
        const formattedDate = now.toLocaleString('ko-KR', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        const commentData = {
            text: text,
            date: editingCommentId ? formattedDate + " (edited)" : formattedDate,
            user: userIP,
            ip: displayIp,
            country: displayCountry
        };

        if (editingCommentId) {
            await db.ref(`posts/${postKey}/comments/${editingCommentId}`).update(commentData);
            editingCommentId = null;
            alert("Comment updated! ✨");
        } else {
            await db.ref(`posts/${postKey}/comments`).push(commentData);
            alert("Comment posted! 🙏");
        }
        
        document.getElementById('commentInput').value = "";
        btn.innerText = "POST COMMENT";
        btn.style.background = "var(--primary-batik)";
        btn.disabled = false;

        viewPost(postKey, true);
        
    } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
    }
}

// --- 1. TOP 버튼 생성 및 스크롤 로직 (기존 함수 유지) ---
function createTopButton() {
    // 이미 버튼이 있다면 생성하지 않음
    if (document.getElementById('scrollToTopBtn')) return;

    const topBtn = document.createElement('button');
    topBtn.id = "scrollToTopBtn";
    topBtn.innerHTML = "TOP";
    topBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--primary-batik, #d4af37);
        color: black;
        border: none;
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        display: none; /* 처음엔 숨김 */
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        transition: 0.3s;
    `;
    
    topBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(topBtn);

    // 스크롤 이벤트 감지
    window.addEventListener('scroll', () => {
        // 300px 이상 내려오면 버튼 보임
        if (window.scrollY > 300) {
            topBtn.style.display = "block";
        } else {
            topBtn.style.display = "none";
        }
    });
}

async function handleLogin() {
    const id = document.getElementById('adminId').value;
    const pw = document.getElementById('adminPw').value;
    try {
        const snap = await db.ref('adminInfo').once('value');
        const admin = snap.val();
        if (admin && id === admin.id && pw === admin.password) {
            sessionStorage.setItem('admin', 'true');
            closeModal('loginModal');
            updateUI();
            if(typeof loadPosts === 'function') loadPosts();
        } else {
            alert('Invalid Credentials.');
        }
    } catch (e) {
        alert('Login Error: ' + e.message);
    }
}
async function forgotPassword() {
    const inputId = prompt("Enter your Admin ID to get a security hint:");
    if (!inputId) return;
    try {
        const snap = await db.ref('adminInfo').once('value');
        const adminData = snap.val();
        if (adminData && inputId === adminData.id) {
            const hint = adminData.password.substring(0, 2);
            alert(`Verified. Your password starts with: [ ${hint} ]`);
        } else {
            alert("Incorrect Admin ID.");
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}
function logout() {
    if (confirm("Are you sure you want to sign out?")) {
        if (firebase.auth) {
            firebase.auth().signOut().then(() => {
                console.log("Firebase Auth signed out.");
            }).catch((error) => {
                console.error("Sign out error:", error);
            });
        }
        sessionStorage.clear();
        localStorage.removeItem('admin');
        window.location.href = 'index.html'; 
    }
}
function updateUI() {
    const auth = sessionStorage.getItem('admin') === 'true';
    const adminControls = document.getElementById('adminControls');
    const loginBtn = document.getElementById('loginBtn');
    if (auth) {
        if(adminControls) adminControls.style.display = 'flex';
        if(loginBtn) loginBtn.style.display = 'none';
        db.ref('adminInfo').once('value', snap => {
            const info = snap.val();
            if (info) {
                if (info.photo) document.getElementById('profileBtn').src = info.photo;
                if (info.name) document.getElementById('aboutText').innerHTML = `Managed by <b>${info.name}</b>. ${info.bio || ''}`;
            }
        });
    } else {
        if(adminControls) adminControls.style.display = 'none';
        if(loginBtn) loginBtn.style.display = 'block';
    }
}
// 기존에 흩어져 있던 모든 window.onload를 삭제하고, 파일 맨 아래에 이 하나만 남기세요.
window.onload = async () => {
    await getUserIP();      // IP 가져오기
    await loadPosts();      // 포스트 로딩
    updateUI();             // UI 업데이트 (관리자 체크)
    createTopButton();      // 상단 이동 버튼 생성 (★이게 빠져있었습니다)
    
    if (window.lucide) lucide.createIcons();
};