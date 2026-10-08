# How to Setup Automated Database Backups

This directory contains `backup_db.py`, a script that automatically backs up your PhotoGuard database (SQLite or PostgreSQL) and saves it to a `backups/` folder.

## For Live Server (Render.com)

If you are hosting the backend on Render, you can use Render's **Cron Job** feature to run this backup automatically every day.

1. In your Render Dashboard, click **New +** and select **Cron Job**.
2. Connect your GitHub repository.
3. Configure the following settings:
   - **Environment:** `Python`
   - **Build Command:** `pip install -r requirements.txt` (or whatever your standard build command is).
   - **Schedule:** `0 0 * * *` (This runs every day at midnight UTC. You can change this using cron syntax).
   - **Command:** `python scripts/backup_db.py`
4. Add the `DATABASE_URL` environment variable under **Environment** (same as your Web Service).
5. (Optional but Recommended) If you want the backups to be saved permanently and not lost between server restarts on Render, you should attach a **Background Disk** to the Cron Job and point the script's `backup_dir` to that disk.

## For AWS / Linux VPS (Ubuntu/Debian)

If you are hosting on your own server (VPS, EC2):

1. SSH into your server.
2. Open the crontab editor: `crontab -e`
3. Add a line to run the script every day at 2 AM:
   `0 2 * * * cd /path/to/photoguard5 && /path/to/venv/bin/python scripts/backup_db.py >> /var/log/photoguard_backup.log 2>&1`

## Downloading the Backups

You can download the generated `.sql` or `.sqlite` files using SFTP, or create a secure admin endpoint in your FastAPI application that lists and downloads files from the `backups/` directory.
