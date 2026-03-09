// Google Drive sync for StudyOS
const CLIENT_ID = "470427375317-jhmi87vugqaqbmescbrp0r1qti1h5e69.apps.googleusercontent.com";
const API_KEY = ""; // not needed for Drive file access via OAuth
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "studyos-data.json";

let tokenClient = null;
let accessToken = null;
let fileId = null;

export function isSignedIn() {
  return !!accessToken;
}

export async function initGoogle() {
  return new Promise((resolve) => {
    window.gapi.load("client", async () => {
      await window.gapi.client.init({
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      });
      resolve();
    });
  });
}

export function initTokenClient(onSuccess, onError) {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (resp) => {
      if (resp.error) { onError(resp.error); return; }
      accessToken = resp.access_token;
      window.gapi.client.setToken({ access_token: accessToken });
      onSuccess();
    },
  });
}

export function signIn() {
  if (tokenClient) tokenClient.requestAccessToken({ prompt: "consent" });
}

export function signOut() {
  if (accessToken) {
    window.google.accounts.oauth2.revoke(accessToken);
    accessToken = null;
    fileId = null;
    window.gapi.client.setToken(null);
  }
}

async function findOrCreateFile() {
  if (fileId) return fileId;
  // Search in appDataFolder
  const res = await window.gapi.client.drive.files.list({
    spaces: "appDataFolder",
    q: `name='${FILE_NAME}'`,
    fields: "files(id, name)",
  });
  const files = res.result.files;
  if (files && files.length > 0) {
    fileId = files[0].id;
    return fileId;
  }
  // Create new file
  const createRes = await window.gapi.client.drive.files.create({
    resource: { name: FILE_NAME, parents: ["appDataFolder"] },
    fields: "id",
  });
  fileId = createRes.result.id;
  return fileId;
}

export async function loadFromDrive() {
  try {
    const fid = await findOrCreateFile();
    const res = await window.gapi.client.drive.files.get({
      fileId: fid,
      alt: "media",
    });
    if (!res.body || res.body === "") return [];
    return JSON.parse(res.body);
  } catch (e) {
    console.error("Drive load error:", e);
    return [];
  }
}

export async function saveToDrive(assignments) {
  try {
    const fid = await findOrCreateFile();
    const content = JSON.stringify(assignments);
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fid}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: content,
    });
  } catch (e) {
    console.error("Drive save error:", e);
  }
}
