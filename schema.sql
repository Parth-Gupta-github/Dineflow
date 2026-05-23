CREATE TABLE IF NOT EXISTS tablestatus (
    tablenumber INTEGER PRIMARY KEY,
    availability SMALLINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS userdata (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(50) UNIQUE NOT NULL,
    phonenumber VARCHAR(15) NOT NULL,
    tablenum INTEGER UNIQUE NOT NULL REFERENCES tablestatus(tablenumber)
);

ALTER TABLE userdata DROP CONSTRAINT IF EXISTS userdata_username_key;
ALTER TABLE userdata DROP CONSTRAINT IF EXISTS userdata_tablenum_key;
ALTER TABLE userdata ADD CONSTRAINT userdata_tablenum_key UNIQUE (tablenum);

CREATE TABLE IF NOT EXISTS dishdata (
    id SERIAL PRIMARY KEY,
    dishname VARCHAR(50) UNIQUE NOT NULL,
    dishdescription VARCHAR(255),
    dishimage BYTEA,
    mimetype VARCHAR(50),
    image_url TEXT,
    dishamount INTEGER NOT NULL
);

ALTER TABLE dishdata ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES userdata(id),
    tablenum INTEGER NOT NULL REFERENCES tablestatus(tablenumber),
    dish_ids TEXT NOT NULL,
    total_amount INTEGER NOT NULL,
    order_status SMALLINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(80) NOT NULL,
    phonenumber VARCHAR(15) NOT NULL,
    feedback TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tablestatus (tablenumber, availability)
VALUES
(1, 0),
(2, 0),
(3, 0),
(4, 0),
(5, 0)
ON CONFLICT (tablenumber) DO UPDATE
SET availability = EXCLUDED.availability;

INSERT INTO dishdata (dishname, dishdescription, image_url, dishamount)
VALUES
('Paneer Butter Masala', 'Creamy paneer curry with rich tomato gravy.', '/dishes/paneer-butter-masala.svg', 220),
('Veg Biryani', 'Fragrant rice cooked with vegetables and spices.', '/dishes/veg-biryani.svg', 180),
('Masala Dosa', 'Crisp dosa served with spiced potato filling.', '/dishes/masala-dosa.svg', 120),
('Cold Coffee', 'Chilled coffee blended with milk and sugar.', '/dishes/cold-coffee.svg', 90),
('Chole Bhature', 'Spiced chickpea curry served with fluffy bhature.', '/dishes/chole-bhature.svg', 160),
('Margherita Pizza', 'Classic cheese pizza with tomato sauce and herbs.', '/dishes/margherita-pizza.svg', 240),
('Hakka Noodles', 'Stir-fried noodles tossed with vegetables and sauces.', '/dishes/hakka-noodles.svg', 150),
('Gulab Jamun', 'Soft milk dumplings soaked in warm sugar syrup.', '/dishes/gulab-jamun.svg', 80)
ON CONFLICT (dishname) DO UPDATE
SET
dishdescription = EXCLUDED.dishdescription,
dishimage = NULL,
mimetype = NULL,
image_url = EXCLUDED.image_url,
dishamount = EXCLUDED.dishamount;
