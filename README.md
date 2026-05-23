# DineFlow

DineFlow is a smart restaurant management web app built to make table ordering, kitchen tracking, payment handling, and customer reviews smoother for restaurants.

## Live Demo

```text
https://dineflow-theta.vercel.app/
```

## Features

- Public homepage, menu, reviews, and about pages
- Customer table registration before ordering
- Full menu browsing for guests
- Cart and order placement for registered table users
- Customer-side table clearing
- Staff login for kitchen and payment counters
- Kitchen order dashboard
- Payment counter with table reset
- Supabase PostgreSQL database integration
- Review/contact form saved in the database

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js, EJS |
| Database | Supabase PostgreSQL |
| Session | express-session |
| DB Driver | pg |

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project.

3. Open Supabase SQL Editor and run the SQL from:

```text
schema.sql
```

4. Open Supabase dashboard, click **Connect**, and copy the **Session pooler** connection string.

5. Create `.env` from `.env.example`, then replace `DATABASE_URL` with your Supabase connection string:

```env
PORT=8080
SESSION_SECRET=change-this-secret
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

6. Initialize or update the database:

```bash
npm run db:init
```

7. Start the app:

```bash
npm start
```

Local app URL:

```text
http://localhost:8080
```

Deployed app URL:

```text
https://dineflow-theta.vercel.app/
```

## App Routes

| Route | Purpose |
| --- | --- |
| `/` | Customer entry / table registration |
| `/home` | Public home page |
| `/menu` | Public menu browsing |
| `/cart` | Customer cart, requires table registration |
| `/reviews` | Contact and review form |
| `/about` | About DineFlow |
| `/login` | Staff login |
| `/kitchen` | Kitchen counter, requires kitchen login |
| `/payment` | Payment counter, requires payment login |

## Staff Credentials

Kitchen counter:

```text
Email: kitchen@gmail.com
Password: kitchen123
```

Payment counter:

```text
Email: payment@gmail.com
Password: payment123
```

## Notes

- Guests can browse Home, Menu, Reviews, and About without registration.
- Adding dishes, opening Cart, placing orders, and clearing tables require customer registration.
- Kitchen and Payment pages require staff login.
- Customer names and emails can repeat, so customer visit history can be retained.
- Kitchen and Payment counters only show placed orders, not in-progress carts.
- Payment reset clears the order and frees the table while keeping customer data.
- Payment counter also has a **Free All Tables** action for end-of-day cleanup.
- Menu images are served from `public/dishes`.
- Reviews are saved in the Supabase `reviews` table.

## Contact

```text
Name: Parth Gupta
Mobile: 8989247785
Address: SGSITS, 23 Sir M. Visvesvaraya Marg, Indore, Madhya Pradesh 452003
```

## Author

Created by Parth Gupta.
