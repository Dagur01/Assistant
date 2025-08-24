import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Disable Next.js's default body parser for this route
export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseForm(req: NextRequest): Promise<{ filepath: string; filename: string }> {
  const form = formidable({
    uploadDir: '/tmp',
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req as any, (err, fields, files: any) => {
      if (err) return reject(err);
      const file = files.file[0];
      resolve({ filepath: file.filepath, filename: file.originalFilename });
    });
  });
}

async function uploadToDrive(filePath: string, fileName: string) {
  // Get credentials from Vercel env vars
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL!;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!; // <- you set this in Vercel

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: fileName,
    parents: ['Kvittanir'], // Google Drive folder ID
  };

  const media = {
    mimeType: "image/jpeg",
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, webViewLink, webContentLink",
  });

  return response.data;
}

export async function POST(req: NextRequest) {
  try {
    const { filepath, filename } = await parseForm(req);
    const driveFile = await uploadToDrive(filepath, filename);
    return NextResponse.json({ success: true, driveFile });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}