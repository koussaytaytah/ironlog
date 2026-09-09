# 🚀 IRONLOG Testing Guide

The server is running at: **http://localhost:4000**

## 🔑 Test Credentials
If you have already created accounts via the signup page, use those. If not, please create accounts with the following roles:

| Role | Example Email | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `super@ironlog.com` | `Password123!` | Platform management, Revenue, Global Stats |
| **Gym Owner** | `owner@testgym.com` | `Password123!` | Gym settings, Member plans, AI Substitutions |
| **Coach** | `coach@testgym.com` | `Password123!` | Program creation, Client tracking, Attendance |
| **Member** | `member@testgym.com` | `Password123!` | Workout logs, Achievements, Leaderboard |

---

## 🛠️ Feature Cheat Sheet

### 👑 Super Admin (Platform Owner)
*   **Global Stats**: View total gyms, users, and growth.
*   **Revenue Tracking**: Monitor MRR, YTD revenue, and pending payments.
*   **Subscription Management**: See which gyms are active, overdue, or locked.
*   **User Audit**: List all users across the entire platform.
*   **Gym Control**: Suspend or unsuspended any gym.

### 🏢 Gym Owner (Gym Manager)
*   **Gym Dashboard**: Manage gym profile and settings.
*   **Membership Plans**: Create and edit plans (Monthly, VIP, etc.) that members buy.
*   **Staff Management**: Add and manage Coaches/Trainers.
*   **Member Management**: Track all gym members and their billing.
*   **AI Operations Assistant**: 
    *   Tell the AI: *"The Leg Press is broken"* $\rightarrow$ AI finds substitutes for all programs.
    *   Apply substitutions across the gym with one click.
*   **Revenue**: Track payments and pending approvals for the gym.

### 🏋️ Coach (Trainer)
*   **Client Management**: View and manage assigned members.
*   **Program Builder**: Create customized training programs.
*   **Attendance**: Mark members as checked-in/out.
*   **Performance Tracking**: Monitor client progress and PRs.
*   **Messaging**: Chat with members in the gym.

### 📱 Gym Member (Client)
*   **My Program**: View and follow assigned workouts.
*   **Workout Logger**: Log sets, reps, and weight.
*   **Attendance**: Check-in to the gym (via self or coach).
*   **Gamification**:
    *   **Achievements**: Unlock badges (e.g., "Early Bird", "100 Visits").
    *   **Streaks**: Track daily gym streaks.
    *   **Leaderboard**: Compete with others in the gym for most check-ins.
*   **Personal Records**: Track and view weight milestones.
*   **Messaging**: Chat with coaches.

---

## 🧪 How to Test the AI Substitution (for Owner)
1. Log in as **Gym Owner**.
2. Go to the **AI Assistant / Chat**.
3. Type: *"The Barbell Bench Press is broken"*
4. The AI will:
    *   Identify the muscle (Chest) and equipment (Barbell).
    *   Suggest replacements (e.g., Dumbbell Bench Press).
    *   List all Programs currently using that exercise.
5. Click **Apply Substitution** to automatically update all programs.
