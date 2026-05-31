# Ankita Verma Interior Portfolio

This project is set up as a single repository for both the React frontend and the Vercel backend functions.

## Recommended structure

- `src/` for the portfolio frontend
- `api/` for Vercel serverless functions
- `vercel.json` for Vercel build and output settings

This is the right setup if you want the frontend and backend deployed together on Vercel. You do not need a separate backend folder unless you want to split the codebase later.

## What is included

- A portfolio homepage with work, about, and consultation sections
- A clickable phone number and email address
- A Vercel contact API route in `api/contact.js`
- A protected admin messages route in `api/admin/messages.js`
- An admin verification route in `api/admin/verify.js`
- A backend-driven project list in `api/projects.js` and `api/admin/projects.js`
- MongoDB connection helper in `api/_lib/mongodb.js`

## How deployment works on Vercel

1. Push this repository to GitHub.
2. Import the repo into Vercel.
3. Set the environment variables in Vercel.
4. Deploy the same repo as one project.

Vercel will serve the React app from the root and the serverless functions from the `api/` folder.

## Environment variables

```bash
MONGODB_URI=your-mongodb-connection-string
MONGODB_DB=portfolio
ADMIN_TOKEN=choose-a-secure-token
REACT_APP_CONTACT_API_URL=/api/contact
REACT_APP_API_BASE_URL=https://your-deployed-site.vercel.app
```

## Local development

```bash
npm install
npm start
```

`npm start` now runs the React app and a small local API server together, so `/api/*` routes work in development.

If you prefer to use the deployed backend from local React only, set `REACT_APP_API_BASE_URL` to your Vercel site.

## Backend flow

- The contact form sends data to `/api/contact`
- The Vercel function validates and stores the enquiry in MongoDB
- The admin page first verifies the token with `/api/admin/verify`
- The admin route can fetch the latest messages with the `x-admin-token` header
- The admin project form saves project name, scope, note, and image URL into MongoDB
- The homepage reads project cards from `/api/projects`

## About project images

The current setup gives you backend control over which images show on the homepage by saving image URLs in MongoDB.

If later you want to upload actual image files from the admin side, add an image storage service such as Cloudinary, UploadThing, or S3. Vercel serverless functions are best for saving the image reference, not for permanent file storage.

## Important note

- If you want to keep everything on Vercel, this same-folder setup is the right choice.
- If later you want a traditional always-on Express server, that is better in a separate backend deployment.
