const firebaseConfig = { databaseURL: "https://jakarta-blog-default-rtdb.firebaseio.com" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let userIP = ""; 
let staticPosts = {}; // posts.json 데이터를 담을 변수

// --- [공통 및 유틸리티] ---
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

// --- [1. 메인 레이아웃 제어] ---

function setRandomHero() {
    const hero = document.getElementById('mainHero');
    if (!hero) return;
    const randomId = Math.floor(Math.random() * 1000);
    const imageUrl = `https://picsum.photos/1600/900?random=${randomId}`;
    hero.style.backgroundImage = `url('${imageUrl}')`;
}

// 통합 로드 함수: JSON 파일 읽기 + Firebase 동적 데이터 매칭
async function loadPosts() {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const hero = document.getElementById('mainHero');
    if (hero) {
        hero.style.height = '85vh';
        hero.querySelector('.hero-title').innerText = "Wonderful Jakarta";
        hero.querySelector('.hero-subtitle').innerText = "Exploring the vibrant fusion of heritage and high-rise.";
        setRandomHero(); 
    }

    try {
        // 1. 정적 JSON 파일 가져오기
        const response = await fetch('assets/data/posts.json');
        staticPosts = await response.json();

        // 2. Firebase에서 동적 데이터(좋아요, 댓글) 가져오기
        db.ref('posts').once('value', snap => {
            const dynamicData = snap.val() || {};
            renderPostList(staticPosts, dynamicData);
        });
    } catch (e) {
        console.error("데이터 로딩 실패:", e);
        document.getElementById('postContainer').innerHTML = '<p>Error loading stories.</p>';
    }
}

// 리스트 렌더링 함수
function renderPostList(staticData, dynamicData) {
    let html = '';
    // 정적 데이터의 키를 기준으로 최신순 정렬하여 출력
    Object.keys(staticData).reverse().forEach(key => {
        const p = staticData[key];
        const d = dynamicData[key] || {}; 
        
        const likes = d.likes || 0;
        const commentsCount = d.comments ? Object.keys(d.comments).length : 0;
        
        // 검색용 텍스트에서 HTML 태그 제거
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

// --- [2. 상세 페이지 보기] ---

function viewPost(key) {
    const p = staticPosts[key]; // 정적 데이터에서 본문 가져오기
    if (!p) return;

    // Firebase에서 실시간 동적 데이터(댓글, 좋아요)만 가져오기
    db.ref(`posts/${key}`).once('value', snap => {
        const d = snap.val() || {};
        const likes = d.likes || 0;
        
        const hero = document.getElementById('mainHero');
        if (hero) {
            hero.style.height = '40vh'; 
            hero.querySelector('.hero-title').innerText = p.title;
            hero.querySelector('.hero-subtitle').innerText = `${p.cat} • ${p.date}`;
        }

        let commentsHtml = '';
        if (d.comments) {
            Object.values(d.comments).forEach(c => {
                commentsHtml += `
                    <div class="comment-item">
                        <p class="comment-text">${c.text}</p>
                        <small class="comment-date">${c.date}</small>
                    </div>`;
            });
        } else {
            commentsHtml = `<p id="noComment" style="color:var(--text-muted);">No comments yet.</p>`;
        }

        document.getElementById('postContainer').innerHTML = `
            <div class="post-detail-view" style="animation: fadeInUp 0.5s ease;">
                <button class="btn-text" onclick="loadPosts()" style="margin-bottom:20px; display:flex; align-items:center; gap:5px; color:var(--primary-batik); background:none; border:none; cursor:pointer;">
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
                </div>

                <hr style="border:0; border-top:1px solid var(--border); margin:40px 0;">
                
                <section class="comment-section">
                    <h3 style="font-family:'Playfair Display', serif; color:var(--primary-batik); margin-bottom:20px;">Comments</h3>
                    <div id="commentList" style="margin-bottom:30px;">
                        ${commentsHtml}
                    </div>

                    <div class="comment-form" style="background:rgba(255,255,255,0.02); border:1px solid var(--border);">
                        <div style="margin-bottom:10px; display:flex; gap:10px; font-size:1.2rem;">
                            <span style="cursor:pointer" onclick="addEmoji('😊')">😊</span>
                            <span style="cursor:pointer" onclick="addEmoji('😍')">😍</span>
                            <span style="cursor:pointer" onclick="addEmoji('👍')">👍</span>
                            <span style="cursor:pointer" onclick="addEmoji('🔥')">🔥</span>
                            <span style="cursor:pointer" onclick="addEmoji('✨')">✨</span>
                        </div>
                        <textarea id="commentInput" rows="3" placeholder="Share your thoughts..."></textarea>
                        <button onclick="addComment('${key}')" class="btn-gold-full">POST COMMENT</button>
                    </div>
                </section>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// --- [좋아요 & 댓글 로직] ---

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

function addComment(postKey) {
    const text = document.getElementById('commentInput').value.trim();
    if (!text) return alert('Please enter your comment.');

    const commentCheckRef = db.ref(`posts/${postKey}/commentedBy/${userIP}`);
    commentCheckRef.once('value', snap => {
        if (snap.exists()) {
            alert('You have already commented on this post. 🙏');
        } else {
            const commentData = {
                text: text,
                date: new Date().toLocaleString(),
                user: userIP
            };
            db.ref(`posts/${postKey}/comments`).push(commentData).then(() => {
                commentCheckRef.set(true);
                viewPost(postKey); 
            });
        }
    });
}

// --- [관리자 및 UI] ---

function handleLogin() {
    const id = document.getElementById('adminId').value;
    const pw = document.getElementById('adminPw').value;
    db.ref('adminInfo').once('value', snap => {
        const admin = snap.val();
        if (admin && id === admin.id && pw === admin.password) {
            sessionStorage.setItem('admin', 'true');
            updateUI();
            closeModal('loginModal');
        } else {
            alert('Authentication failed.');
        }
    });
}

function logout() {
    sessionStorage.removeItem('admin');
    window.location.reload();
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

// --- [초기화] ---
window.onload = async () => {
    await getUserIP(); 
    loadPosts(); // JSON + Firebase 통합 로드
    updateUI();
    if (window.lucide) lucide.createIcons();
};