import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    forgotPassword,
    logoutUser,
    deleteUserAccount,
    updateUserProfile,
    resendVerification
} from "./auth.js";
import { syncUserDataToCloud, loadUserDataFromCloud, startAutoSync, stopAutoSync } from "./database.js";

// ── Auth state observer ──────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    updateAuthUI(user);
    if (user) {
        await loadUserDataFromCloud(user.uid);
        showToast(
            user.isAnonymous ? "Browsing as Guest" : `Welcome, ${user.displayName || user.email}!`,
            "success"
        );
        if (!user.isAnonymous) startAutoSync(user.uid);
    }
});

// ── UI update ────────────────────────────────────────────────────────────────
function updateAuthUI(user) {
    const headerAuthBtn     = document.getElementById("header-auth-btn");
    const headerUserInfo    = document.getElementById("header-user-info");
    const headerUserName    = document.getElementById("header-user-name");
    const headerUserAvatar  = document.getElementById("header-user-avatar");
    const verificationBanner = document.getElementById("email-verification-banner");

    if (user) {
        if (headerAuthBtn)  headerAuthBtn.style.display  = "none";
        if (headerUserInfo) headerUserInfo.style.display = "flex";
        if (headerUserName) {
            headerUserName.textContent = user.isAnonymous
                ? "Guest"
                : (user.displayName || user.email.split("@")[0]);
        }
        if (headerUserAvatar) {
            if (user.photoURL) {
                headerUserAvatar.src = user.photoURL;
                headerUserAvatar.style.display = "block";
            } else {
                headerUserAvatar.style.display = "none";
            }
        }
        if (verificationBanner) {
            verificationBanner.style.display =
                (user.email && !user.emailVerified && !user.isAnonymous) ? "flex" : "none";
        }
        updateAccountPanel(user);
    } else {
        if (headerAuthBtn)  headerAuthBtn.style.display  = "flex";
        if (headerUserInfo) headerUserInfo.style.display = "none";
        if (verificationBanner) verificationBanner.style.display = "none";
        updateAccountPanel(null);
        stopAutoSync();
    }
}

function updateAccountPanel(user) {
    const panel = document.getElementById("account-panel-content");
    if (!panel) return;

    if (!user) {
        panel.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--text-muted);">
                <div style="font-size:3rem;margin-bottom:1rem;">👤</div>
                <p style="margin-bottom:1.5rem;">Sign in to sync your data across devices.</p>
                <button class="calc-key accent" style="width:100%;" onclick="openAuthModal()">Sign In / Create Account</button>
                <button class="calc-key" style="width:100%;margin-top:0.5rem;" onclick="continueAsGuest()">Continue as Guest</button>
            </div>`;
        return;
    }

    const avatarHtml = user.photoURL
        ? `<img src="${user.photoURL}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--accent-color);">`
        : `<div style="width:80px;height:80px;border-radius:50%;background:var(--accent-gradient);display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff;">${(user.displayName || user.email || "G")[0].toUpperCase()}</div>`;

    panel.innerHTML = `
        <div style="text-align:center;margin-bottom:1.5rem;">
            ${avatarHtml}
            <h3 style="margin-top:0.8rem;font-weight:700;">${user.displayName || "User"}</h3>
            <p style="color:var(--text-muted);font-size:0.85rem;">${user.email || "Guest Mode"}</p>
            ${user.email && !user.emailVerified ? '<p style="color:#f59e0b;font-size:0.8rem;margin-top:0.3rem;">⚠️ Email not verified</p>' : ""}
            <span id="cloud-sync-status" style="font-size:0.8rem;display:block;margin-top:0.4rem;"></span>
        </div>
        <div class="card-title" style="font-size:1rem;">Profile Settings</div>
        <div class="form-group">
            <label>Display Name</label>
            <input type="text" id="profile-display-name" value="${user.displayName || ""}" placeholder="Enter your name">
        </div>
        <div class="form-group">
            <label>Profile Photo URL</label>
            <input type="text" id="profile-photo-url" value="${user.photoURL || ""}" placeholder="https://...">
        </div>
        <button class="calc-key accent" style="width:100%;margin-bottom:0.5rem;" onclick="saveProfileSettings()">Save Profile</button>
        <div class="card-title" style="font-size:1rem;margin-top:1.5rem;">Cloud Sync</div>
        <button class="calc-key" style="width:100%;margin-bottom:0.5rem;" onclick="manualCloudSync()">☁️ Sync Now</button>
        <div class="card-title" style="font-size:1rem;margin-top:1.5rem;color:#ef4444;">Danger Zone</div>
        <button class="calc-key" style="width:100%;background:#ef4444;color:#fff;border:none;margin-bottom:0.5rem;" onclick="handleLogout()">Sign Out</button>
        <button class="calc-key" style="width:100%;background:#7f1d1d;color:#fca5a5;border:1px solid #ef4444;" onclick="showDeleteAccountModal()">Delete Account</button>`;
}

// ── Toast notifications ──────────────────────────────────────────────────────
export function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.style.cssText = `
            position:fixed;top:1rem;right:1rem;z-index:99999;
            display:flex;flex-direction:column;gap:0.5rem;max-width:340px;`;
        document.body.appendChild(container);
    }
    const colors = {
        success: { bg:"#166534", border:"#22c55e", text:"#dcfce7" },
        error:   { bg:"#7f1d1d", border:"#ef4444", text:"#fee2e2" },
        info:    { bg:"#1e3a5f", border:"#3b82f6", text:"#dbeafe" },
        warning: { bg:"#78350f", border:"#f59e0b", text:"#fef3c7" }
    };
    const c = colors[type] || colors.info;
    const toast = document.createElement("div");
    toast.style.cssText = `
        padding:0.75rem 1rem;border-radius:8px;font-size:0.9rem;font-weight:500;
        background:${c.bg};border:1px solid ${c.border};color:${c.text};
        box-shadow:0 4px 20px rgba(0,0,0,0.4);cursor:pointer;
        animation:slideInRight 0.3s ease;`;
    toast.textContent = message;
    toast.onclick = () => toast.remove();
    if (!document.getElementById("toast-anim-style")) {
        const style = document.createElement("style");
        style.id = "toast-anim-style";
        style.textContent = `
            @keyframes slideInRight{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
            @keyframes fadeOut{from{opacity:1}to{opacity:0}}`;
        document.head.appendChild(style);
    }
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.4s ease forwards";
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ── Global window functions (called by onclick= in HTML) ────────────────────

window.openAuthModal = function () {
    const modal = document.getElementById("auth-modal");
    if (modal) { modal.style.display = "flex"; }
    showAuthTab("login");
};

window.closeAuthModal = function () {
    const modal = document.getElementById("auth-modal");
    if (modal) modal.style.display = "none";
};

window.showAuthTab = function (tab) {
    document.querySelectorAll(".auth-tab-panel").forEach(p => p.style.display = "none");
    document.querySelectorAll(".auth-tab-btn").forEach(b => b.classList.remove("active-tab"));
    const panel = document.getElementById(`auth-tab-${tab}`);
    const btn   = document.getElementById(`auth-tabBtn-${tab}`);
    if (panel) panel.style.display = "block";
    if (btn)   btn.classList.add("active-tab");
};

window.handleGoogleLogin = async function () {
    const rememberMe = document.getElementById("login-remember-me")?.checked ?? true;
    window.closeAuthModal();
    const result = await loginWithGoogle(rememberMe);
    if (!result.success) showToast(result.message, result.type);
};

window.handleEmailLogin = async function () {
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const rememberMe = document.getElementById("login-remember-me")?.checked ?? false;
    if (!email || !password) { showToast("Please fill in all fields.", "warning"); return; }
    const result = await loginWithEmail(email, password, rememberMe);
    showToast(result.message, result.type);
    if (result.success) window.closeAuthModal();
};

window.handleEmailRegister = async function () {
    const name     = document.getElementById("reg-name").value.trim();
    const email    = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirm  = document.getElementById("reg-confirm").value;
    const rememberMe = document.getElementById("reg-remember-me")?.checked ?? true;
    if (!email || !password) { showToast("Please fill in all fields.", "warning"); return; }
    if (password !== confirm) { showToast("Passwords do not match.", "error"); return; }
    if (password.length < 6)  { showToast("Password must be at least 6 characters.", "warning"); return; }
    const result = await registerWithEmail(email, password, name, rememberMe);
    showToast(result.message, result.type);
    if (result.success) showAuthTab("login");
};

window.handleForgotPassword = async function () {
    const email = document.getElementById("forgot-email").value.trim();
    if (!email) { showToast("Please enter your email address.", "warning"); return; }
    const result = await forgotPassword(email);
    showToast(result.message, result.type);
};

window.continueAsGuest = function () {
    window.closeAuthModal();
    showToast("Browsing as Guest — data saved locally only.", "info");
};

window.handleLogout = async function () {
    const result = await logoutUser();
    showToast(result.message, result.type);
};

window.saveProfileSettings = async function () {
    const displayName = document.getElementById("profile-display-name")?.value.trim();
    const photoURL    = document.getElementById("profile-photo-url")?.value.trim();
    const result = await updateUserProfile(displayName, photoURL);
    showToast(result.message, result.type);
    updateAuthUI(auth.currentUser);
};

window.manualCloudSync = async function () {
    if (!auth.currentUser) { showToast("Sign in to sync your data.", "warning"); return; }
    showToast("Syncing...", "info");
    await syncUserDataToCloud(auth.currentUser.uid);
};

window.showDeleteAccountModal = function () {
    const modal = document.getElementById("delete-account-modal");
    if (modal) modal.style.display = "flex";
};

window.closeDeleteModal = function () {
    const modal = document.getElementById("delete-account-modal");
    if (modal) modal.style.display = "none";
};

window.confirmDeleteAccount = async function () {
    const password = document.getElementById("delete-confirm-password")?.value || "";
    const result = await deleteUserAccount(password);
    showToast(result.message, result.type);
    if (result.success) window.closeDeleteModal();
};

window.resendVerificationEmail = async function () {
    const result = await resendVerification();
    showToast(result.message, result.type);
};
