import { auth } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail,
    deleteUser,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const googleProvider = new GoogleAuthProvider();

export async function registerWithEmail(email, password, displayName, rememberMe) {
    try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) await updateProfile(result.user, { displayName });
        await sendEmailVerification(result.user);
        return { success: true, user: result.user, message: "Account created! Please check your email to verify.", type: "success" };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error.code), type: "error" };
    }
}

export async function loginWithEmail(email, password, rememberMe) {
    try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const result = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: result.user, message: `Welcome back, ${result.user.displayName || result.user.email}!`, type: "success" };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error.code), type: "error" };
    }
}

export async function loginWithGoogle(rememberMe) {
    try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const result = await signInWithPopup(auth, googleProvider);
        return { success: true, user: result.user, message: `Welcome, ${result.user.displayName}!`, type: "success" };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error.code), type: "error" };
    }
}

export async function forgotPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: "Password reset email sent! Check your inbox.", type: "success" };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error.code), type: "error" };
    }
}

export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true, message: "Signed out successfully.", type: "info" };
    } catch (error) {
        return { success: false, message: "Sign out failed. Please try again.", type: "error" };
    }
}

export async function deleteUserAccount(password) {
    try {
        const user = auth.currentUser;
        if (!user) return { success: false, message: "No user logged in.", type: "error" };
        if (password && user.email) {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
        }
        await deleteUser(user);
        return { success: true, message: "Account permanently deleted.", type: "info" };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error.code), type: "error" };
    }
}

export async function updateUserProfile(displayName, photoURL) {
    try {
        const user = auth.currentUser;
        if (!user) return { success: false, message: "No user logged in.", type: "error" };
        const updates = {};
        if (displayName) updates.displayName = displayName;
        if (photoURL) updates.photoURL = photoURL;
        await updateProfile(user, updates);
        return { success: true, message: "Profile updated successfully!", type: "success" };
    } catch (error) {
        return { success: false, message: "Profile update failed.", type: "error" };
    }
}

export async function resendVerification() {
    try {
        const user = auth.currentUser;
        if (user) await sendEmailVerification(user);
        return { success: true, message: "Verification email sent!", type: "success" };
    } catch (error) {
        return { success: false, message: "Failed to send verification email.", type: "error" };
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
        "auth/popup-blocked": "Popup was blocked by browser. Please allow popups for this site.",
        "auth/requires-recent-login": "Please re-login to perform this action.",
        "auth/network-request-failed": "Network error. Check your connection.",
        "auth/invalid-credential": "Invalid credentials. Please try again.",
        "auth/cancelled-popup-request": "Sign-in cancelled."
    };
    return messages[code] || "An error occurred. Please try again.";
}
