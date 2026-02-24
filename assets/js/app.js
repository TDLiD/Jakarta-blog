const firebaseConfig = { databaseURL: "https://jakarta-blog-default-rtdb.firebaseio.com" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let userIP = ""; // 사용자의 IP 저장 변수

// --- [공통 및 유틸리티] ---
const openLogin = () => document.getElementById('loginModal').style.display = 'flex';
const openPostModal = () => document.getElementById('postModal').style.display = 'flex';
const closeModal = id => document.getElementById(id).style.display = 'none';

// 사용자 IP 가져오기 (중복 방지용)
async function getUserIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        userIP = data.ip.replace(/\./g, '_'); // Firebase 키에 .이 들어갈 수 없어 _로 변환
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

function loadPosts() {
    // 1. 페이지 최상단으로 부드럽게 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. 히로 섹션(배너) 복구
    const hero = document.getElementById('mainHero');
    if (hero) {
        hero.style.height = '85vh'; // 메인 배너 높이로 복구
        hero.querySelector('.hero-title').innerText = "Wonderful Jakarta";
        hero.querySelector('.hero-subtitle').innerText = "Exploring the vibrant fusion of heritage and high-rise.";
        // 필요하다면 배경 이미지도 새로 고침
        setRandomHero(); 
    }

    // 3. 데이터 로딩 및 리스트 출력
    db.ref('posts').once('value', snap => {
        const allPosts = snap.val() || {};
        let html = '';
        
        // 최신글 순으로 정렬
        Object.keys(allPosts).reverse().forEach(key => {
            const p = allPosts[key];
            const likes = p.likes || 0;
            const comments = p.comments ? Object.keys(p.comments).length : 0;
            
            html += `
            <article class="post-card" onclick="viewPost('${key}')" style="cursor:pointer;">
                <div class="post-image" style="background-image:url('${p.img}')"></div>
                <div class="post-info">
                    <span class="post-cat-tag">${p.cat}</span>
                    <h3 class="post-list-title">${p.title}</h3>
                    <p class="post-list-desc">${p.desc.replace(/<[^>]*>?/gm, '').substring(0, 130)}...</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; border-top:1px solid rgba(255,255,255,0.05); padding-top:15px;">
                        <small style="color:var(--text-muted); font-size:0.75rem;">${p.date}</small>
                        <div style="font-size:0.8rem; color:var(--primary-batik);">
                            <span style="margin-right:10px;">❤ ${likes}</span>
                            <span>💬 ${comments}</span>
                        </div>
                    </div>
                </div>
            </article>`;
        });
        
        const container = document.getElementById('postContainer');
        container.innerHTML = html || '<p>No stories found.</p>';
        
        // 아이콘 다시 그리기 (Lucide)
        if (window.lucide) lucide.createIcons();
    });
}

// --- [2. 상세 페이지 보기 (좋아요/댓글 기능 포함)] ---

function viewPost(key) {
    db.ref(`posts/${key}`).once('value', snap => {
        const p = snap.val();
        if (!p) return;

        const hero = document.getElementById('mainHero');
        if (hero) {
            hero.style.height = '40vh'; 
            hero.querySelector('.hero-title').innerText = p.title;
            hero.querySelector('.hero-subtitle').innerText = `${p.cat} • ${p.date}`;
        }

        const container = document.getElementById('postContainer');
        
        // 댓글 렌더링 로직
        let commentsHtml = '';
        if (p.comments) {
            Object.values(p.comments).forEach(c => {
                commentsHtml += `
                    <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:10px; margin-bottom:10px; border-left:3px solid var(--primary-batik);">
                        <p style="margin:0; font-size:0.95rem;">${c.text}</p>
                        <small style="color:var(--text-muted); font-size:0.75rem;">${c.date}</small>
                    </div>`;
            });
        } else {
            commentsHtml = `<p id="noComment" style="color:var(--text-muted);">No comments yet.</p>`;
        }

        container.innerHTML = `
            <div class="post-detail-view" style="animation: fadeInUp 0.5s ease;">
                <button class="btn-text" onclick="loadPosts()" style="text-align:left; margin-bottom:20px; display:flex; align-items:center; gap:5px; color:var(--primary-batik); background:none; border:none; cursor:pointer;">
                    <i data-lucide="arrow-left"></i> Back to List
                </button>
                
                <img src="${p.img}" style="width:100%; border-radius:15px; margin-bottom:30px; object-fit:cover; max-height:500px; border: 1px solid var(--border);">
                
                <div class="post-content" style="line-height:1.8; font-size:1.1rem; color:var(--text-main); margin-bottom:40px;">
                    ${p.desc}
                </div>

                <div style="text-align:center; margin-bottom:40px;">
                    <button onclick="handleLike('${key}')" style="background:rgba(212,175,55,0.1); border:1px solid var(--primary-batik); color:var(--primary-batik); padding:10px 25px; border-radius:30px; cursor:pointer; font-weight:bold; display:inline-flex; align-items:center; gap:8px;">
                        <i data-lucide="heart"></i> <span id="detailLikeCount">${p.likes || 0}</span>
                    </button>
                </div>

                <hr style="border:0; border-top:1px solid var(--border); margin:40px 0;">
                
                <section class="comment-section">
                    <h3 style="font-family:'Playfair Display', serif; color:var(--primary-batik); margin-bottom:20px;">Comments</h3>
                    
                    <div id="commentList" style="margin-bottom:30px;">
                        ${commentsHtml}
                    </div>

                    <div style="background:rgba(255,255,255,0.02); padding:20px; border-radius:15px; border:1px solid var(--border);">
                        <div style="margin-bottom:10px; display:flex; gap:10px; font-size:1.2rem;">
                            <span style="cursor:pointer" onclick="addEmoji('😊')">😊</span>
                            <span style="cursor:pointer" onclick="addEmoji('😍')">😍</span>
                            <span style="cursor:pointer" onclick="addEmoji('👍')">👍</span>
                            <span style="cursor:pointer" onclick="addEmoji('🔥')">🔥</span>
                            <span style="cursor:pointer" onclick="addEmoji('✨')">✨</span>
                        </div>
                        <textarea id="commentInput" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:white; border-radius:8px; padding:12px; margin-bottom:10px; resize:none;" rows="3" placeholder="Share your thoughts..."></textarea>
                        <button onclick="addComment('${key}')" class="btn-gold" style="width:100%;">POST COMMENT</button>
                    </div>
                </section>

                <div style="margin-top:50px; text-align:center; border-top:1px solid var(--border); padding-top:30px;">
                    <button class="btn-text" onclick="loadPosts()" style="color:var(--text-muted); cursor:pointer; background:none; border:none; display:inline-flex; align-items:center; gap:8px;">
                         <i data-lucide="layout-list"></i> Back to Post List
                    </button>
                </div>
            </div>
        `;

        lucide.createIcons();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// --- [신규 기능: 좋아요 & 댓글 로직] ---

// 1. 이모티콘 입력
function addEmoji(emoji) {
    const input = document.getElementById('commentInput');
    input.value += emoji;
}

// 2. 좋아요 처리 (IP 중복체크)
function handleLike(postKey) {
    const likeRef = db.ref(`posts/${postKey}/likedBy/${userIP}`);
    likeRef.once('value', snap => {
        if (snap.exists()) {
            alert('You already liked this post! ❤️');
        } else {
            db.ref(`posts/${postKey}/likes`).transaction(current => (current || 0) + 1);
            likeRef.set(true);
            // UI 업데이트
            const countSpan = document.getElementById('detailLikeCount');
            countSpan.innerText = parseInt(countSpan.innerText) + 1;
        }
    });
}

// 3. 댓글 추가 (IP 중복체크)
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
                alert('Comment posted!');
                viewPost(postKey); // 화면 갱신
            });
        }
    });
}

// --- [3. 관리자 기능 및 UI] ---

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

function savePost() {
    const title = document.getElementById('postTitle').value;
    const cat = document.getElementById('postCat').value;
    const img = document.getElementById('postImg').value;
    const desc = document.getElementById('postDesc').value;

    if(!title || !desc) return alert('Please fill in required fields.');

    const newPostRef = db.ref('posts').push();
    newPostRef.set({
        title, cat, img: img || 'https://picsum.photos/800/500', desc,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        likes: 0
    }).then(() => {
        closeModal('postModal');
        loadPosts();
    });
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

// --- [4. 초기화] ---
window.onload = async () => {
    await getUserIP(); // IP 먼저 가져오기
    setRandomHero();
    loadPosts();
    updateUI();
    lucide.createIcons();
};