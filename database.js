import { db } from "./firebase-config.js";
import {
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function syncUserDataToCloud(uid) {
    try {
        const stickyNotesEl  = document.getElementById("sticky-notes-area");
        const notebookEl     = document.getElementById("notebook-area");
        const stickyNotes    = stickyNotesEl  ? stickyNotesEl.value  : "";
        const notebookContent = notebookEl    ? notebookEl.value     : "";
        const theme          = document.documentElement.getAttribute("data-theme") || "dark";
        const variables      = (typeof appState !== "undefined") ? (appState.variables || {}) : {};

        await setDoc(doc(db, "users", uid, "data", "calcData"), {
            stickyNotes, notebookContent, theme, variables,
            updatedAt: serverTimestamp()
        }, { merge: true });

        showSyncStatus("synced");
        return { success: true };
    } catch (error) {
        showSyncStatus("error");
        return { success: false, error: error.message };
    }
}

export async function loadUserDataFromCloud(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid, "data", "calcData"));
        if (snap.exists()) {
            const data = snap.data();
            if (data.stickyNotes !== undefined) {
                const el = document.getElementById("sticky-notes-area");
                if (el) { el.value = data.stickyNotes; localStorage.setItem("sha_sticky_notes", data.stickyNotes); }
            }
            if (data.notebookContent !== undefined) {
                const el = document.getElementById("notebook-area");
                if (el) el.value = data.notebookContent;
            }
            if (data.theme) {
                document.documentElement.setAttribute("data-theme", data.theme);
            }
            if (data.variables && typeof appState !== "undefined") {
                Object.assign(appState.variables, data.variables);
                if (typeof populateVariableMatrixGrid === "function") populateVariableMatrixGrid();
            }
            showSyncStatus("loaded");
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function deleteUserDataFromCloud(uid) {
    try {
        await deleteDoc(doc(db, "users", uid, "data", "calcData"));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function showSyncStatus(status) {
    const el = document.getElementById("cloud-sync-status");
    if (!el) return;
    if (status === "synced")      { el.textContent = "☁️ Synced";            el.style.color = "#22c55e"; }
    else if (status === "loaded") { el.textContent = "☁️ Loaded from cloud"; el.style.color = "#3b82f6"; }
    else                          { el.textContent = "⚠️ Sync failed";       el.style.color = "#f59e0b"; }
    setTimeout(() => { if (el) el.textContent = ""; }, 4000);
}

let autoSyncInterval = null;

export function startAutoSync(uid) {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    autoSyncInterval = setInterval(() => syncUserDataToCloud(uid), 60000);
}

export function stopAutoSync() {
    if (autoSyncInterval) { clearInterval(autoSyncInterval); autoSyncInterval = null; }
}
