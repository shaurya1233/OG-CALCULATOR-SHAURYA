import { auth } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail,
    onAuthStateChanged,
    deleteUser,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { syncUserDataToCloud, loadUserDataFromCloud } from "./database.js";
import { updateAuthUI, showToast } from "./auth-ui.js";

const googleProvider = new GoogleAuthProvider();

export let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthUI(user);
    if (user) {
        await loadUserDataFromCloud(user.uid);
        showToast(user.isAnonymous ? "Browsing as Guest" : `Welcome, ${user.displayName || user.email}!`, "success");
    }
});

export async function registerWithEmail(email, password, displayName, rememberMe) {
    try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
            await updateProfile(result.user, { displayName });
        }
        await sendEmailVerification(result.user);
        showToast("Account created! Please check your email to verify your account.", "success");
        return { success: true, user: result.user };
    } catch (error) {
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.message };
    }
}

export async function loginWithEmail(email, password, rememberMe) {
    try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const result = await signInWithEmailAndPassword(auth, email, password);
        showToast(`Welcome back, ${result.user.displayName || result.user.email}!`, "success");
        return { success: true, user: result.user };
    } catch (error) {
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.message };
    }
}

export async function loginWithGoogle(rememberMe) {
    try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const result = await signInWithPopup(auth, googleProvider);
        showToast(`Welcome, ${result.user.displayName}!`, "success");
        return { success: true, user: result.user };
    } catch (error) {
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.message };
    }
}

export async function forgotPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Password reset email sent! Please check your inbox.", "success");
        return { success: true };
    } catch (error) {
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.message };
    }
}

export async function logoutUser() {
    try {
        if (currentUser && !currentUser.isAnonymous) {
            await syncUserDataToCloud(currentUser.uid);
        }
        await signOut(auth);
        showToast("Signed out successfully.", "info");
        return { success: true };
    } catch (error) {
        showToast("Sign out failed. Please try again.", "error");
        return { success: false, error: error.message };
    }
}

export async function deleteUserAccount(password) {
    try {
        if (!currentUser) return { success: false };
        if (password) {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);
        }
        await deleteUser(currentUser);
        showToast("Account permanently deleted.", "info");
        return { success: true };
    } catch (error) {
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.message };
    }
}

export async function updateUserProfile(displayName, photoURL) {
    try {
        if (!currentUser) return { success: false };
        const updates = {};
        if (displayName) updates.displayName = displayName;
        if (photoURL) updates.photoURL = photoURL;
        await updateProfile(currentUser, updates);
        updateAuthUI(currentUser);
        showToast("Profile updated successfully!", "success");
        return { success: true };
    } catch (error) {
        showToast("Profile update failed. Please try again.", "error");
        return { success: false, error: error.message };
    }
}

function getAuthErrorMessage(code) {
    const messages = {
        "auth/email-already-in-use": "This email is already registered.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password. Please try again.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
        "auth/popup-closed-by-user": "Google sign-in was cancelled.",
        "auth/requires-recent-login": "Please re-login to perform this action.",
        "auth/network-request-failed": "Network error. Check your connection.",
        "auth/invalid-credential": "Invalid credentials. Please try again."
    };
    return messages[code] || "An error occurred. Please try again.";
}
