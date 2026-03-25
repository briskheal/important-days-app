# 🗓️ Important Days - Daily Global & India Celebrations

A modern web application to discover important days, festivals, and celebrations worldwide and in India. Features AI-powered content generation for social media sharing.

## 🚀 Deployment Guide (GitHub & Render.com)

### 1. GitHub Upload
- Create a new **PRIVATE** repository on GitHub.
- Push the code using:
  ```bash
  git init
  git add .
  git commit -m "initial commit"
  git branch -M main
  git remote add origin YOUR_REPO_URL
  git push -u origin main
  ```
- **Note:** Sensitive configuration (`.env`) and local data files are ignored via `.gitignore`.

### 2. Render.com Deployment
- Create a new **Web Service** on Render.
- Connect your GitHub repository.
- **Environment Settings:**
  - Build Command: `npm install`
  - Start Command: `node server.js`
- **Environment Variables (CRITICAL):**
  - Go to the **Environment** tab in Render and add:
    - `MONGODB_URI`: Your MongoDB Atlas connection string (e.g. `mongodb+srv://...`)
    - `EMAIL_USER`: `icdays.app@gmail.com`
    - `EMAIL_PASS`: Your Gmail App Password (16 characters)
    - `PORT`: `8083`

### 3. Database Setup
- This app uses **MongoDB Atlas** for data persistence. 
- Ensure your MongoDB Atlas cluster allows connections from `0.0.0.0/0` (standard for Render) or add Render's IP if you have a static IP add-on.
- The app will automatically create the `users`, `payments`, and `admins` collections on first run.
- Admin Panel is accessible at: `https://your-app.onrender.com/admin`

## 🛠️ Local Development
- Recommended: `node server.js`
- Access at: `http://localhost:8083`

## 💎 Features
- **Dynamic Calendar:** Interactive monthly grid with special days.
- **AI Content:** One-click awareness posts for X (Twitter), Facebook, LinkedIn, and Instagram.
- **Admin Panel:** Manage user registrations and approve subscription payments.
- **PWA Ready:** Installable on mobile and desktop.
