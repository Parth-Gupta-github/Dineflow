require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const app = express();
const port = process.env.PORT || 8080;
const path = require("path");
const { v4: uuidv4 } = require('uuid');
const methodOverride= require("method-override");
const session = require('express-session');

app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname,"views"));

app.use(express.static(path.join(__dirname,"public")));

const databaseUrl = process.env.DATABASE_URL;
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl ? { rejectUnauthorized: false } : undefined
});

const toPostgresQuery = (sql) => {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
};

const connection = {
    query(sql, params, callback) {
        if (typeof params === "function") {
            callback = params;
            params = [];
        }

        pool.query(toPostgresQuery(sql), params, (err, result) => {
            if (err) {
                console.error("Database query failed:", err.message);
            }
            callback(err, result ? result.rows : undefined);
        });
    }
};

const requireCustomerTable = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect("/");
    }

    const activeTableQuery = `
        SELECT u.id, u.tablenum, t.availability
        FROM userdata u
        JOIN tablestatus t ON u.tablenum = t.tablenumber
        WHERE u.id = ?
    `;

    connection.query(activeTableQuery, [req.session.userId], (err, result) => {
        if (err) {
            return res.status(500).send("Error checking table session.");
        }

        if (result.length === 0 || result[0].availability !== 1) {
            return req.session.destroy(() => res.redirect("/"));
        }

        next();
    });
};

const requireStaffRole = (role) => {
    return (req, res, next) => {
        if (req.session.staffRole !== role) {
            return res.redirect("/login");
        }

        next();
    };
};

app.get("/",(req,res) => {
    res.render("index.ejs");
});

app.get("/home", (req, res) => {
    res.render("home.ejs");  
});


app.get('/kitchen', requireStaffRole("kitchen"), (req, res) => {
    const dishQuery = 'SELECT id, dishname FROM dishdata'; 
    const orderQuery = 'SELECT * FROM orders WHERE order_status = 1 ORDER BY order_id DESC';

    connection.query(dishQuery, (err, dishres) => {
        if (err) {
            return res.status(500).send("Error in dish data.");
        }

        let dishMap = {};
        dishres.forEach(dish => {
            dishMap[dish.id] = dish.dishname; 
        });

        connection.query(orderQuery, (err, orderres) => {
            if (err) {
                return res.status(500).send("Failed to get order data");
            }

            let orders = orderres.map(order => {
                let dishCount = {};
                let orderItem = order.dish_ids ? order.dish_ids.split(" ") : []; 
                
                orderItem.forEach(id => {
                    dishCount[id] = (dishCount[id] || 0) + 1;
                });

                let dishes = Object.keys(dishCount).map(id => ({
                    name: dishMap[id] || `Unknown Dish (${id})`, 
                    quantity: dishCount[id]
                }));

                return {
                    order_id: order.order_id,
                    tablenum: order.tablenum,
                    order_status: order.order_status,
                    dishes: dishes
                };
            });

            res.render("kitchen.ejs", { orders });
        });
    });
});


app.get("/menu", (req,res) => {
    const q='SELECT * FROM dishdata';
    try{
        connection.query(q, (err, result) => {
            if(err) throw err;

            result.forEach(dish => {
                if (dish.dishimage) {
                    dish.dishimage = Buffer.from(dish.dishimage).toString('base64');
                }
            });
            
            let post = result;
            res.render("menu.ejs",{post, isCustomerLoggedIn: Boolean(req.session.userId)})
        });
        }catch(err) {
            console.log(err);
            res.send("some error in DB")
        }
});

app.post("/add-to-cart", requireCustomerTable, (req, res) => {
    const { dishId } = req.body;
    let userId = req.session.userId;

    if (!dishId || !userId) {
        return res.status(400).send("Dish ID or User ID is missing!");
    }

    const getTableQuery = `SELECT tablenum FROM userdata WHERE id = ?`;
    connection.query(getTableQuery, [userId], (err, userResult) => {
        if (err || userResult.length === 0) {
            return res.status(500).send("Error fetching table number.");
        }
        
        let tableNum = userResult[0].tablenum;

        const getDishAmountQuery = `SELECT dishamount FROM dishdata WHERE id = ?`;
        connection.query(getDishAmountQuery, [dishId], (err, dishResult) => {
            if (err || dishResult.length === 0) {
                return res.status(500).send("Error fetching dish price.");
            }

            let dishPrice = dishResult[0].dishamount;

            const checkOrderQuery = `SELECT dish_ids, total_amount FROM orders WHERE user_id = ?`;
            connection.query(checkOrderQuery, [userId], (err, orderResult) => {
                if (err) {
                    return res.status(500).send("Error checking order data.");
                }

                if (orderResult.length > 0) {
                    let existingDishIds = orderResult[0].dish_ids || "";
                    let updatedDishIds = existingDishIds ? existingDishIds + " " + dishId : dishId;
                    let updatedTotalAmount = orderResult[0].total_amount + dishPrice;

                    const updateOrderQuery = `UPDATE orders SET dish_ids = ?, total_amount = ? WHERE user_id = ?`;
                    connection.query(updateOrderQuery, [updatedDishIds, updatedTotalAmount, userId], (err) => {
                        if (err) {
                            return res.status(500).send("Error updating order.");
                        }
                        res.redirect("/menu");
                    });

                } else {
                    const insertOrderQuery = `INSERT INTO orders (user_id, tablenum, dish_ids, total_amount) VALUES (?, ?, ?, ?)`;
                    connection.query(insertOrderQuery, [userId, tableNum, dishId, dishPrice], (err) => {
                        if (err) {
                            return res.status(500).send("Error inserting new order.");
                        }
                        res.redirect("/menu");
                    });
                }
            });
        });
    });
});

app.get("/login",(req,res) => {
    res.render("login.ejs");
});
app.get("/offers",(req,res) => {
    res.render("offers.ejs");
});

app.get("/reviews",(req,res) => {
    const reviewQuery = "SELECT username, feedback, created_at FROM reviews ORDER BY created_at DESC LIMIT 6";

    connection.query(reviewQuery, (err, reviews) => {
        if (err) {
            return res.status(500).send("Error loading reviews.");
        }

        res.render("reviews.ejs", { reviews });
    });
});

app.post("/reviews", (req, res) => {
    const { username, email, phonenumber, feedback } = req.body;

    if (!username || !email || !phonenumber || !feedback) {
        return res.status(400).send("Please fill all review fields.");
    }

    const insertReviewQuery = "INSERT INTO reviews (username, email, phonenumber, feedback) VALUES (?, ?, ?, ?)";
    connection.query(insertReviewQuery, [username, email, phonenumber, feedback], (err) => {
        if (err) {
            return res.status(500).send("Error submitting review.");
        }

        res.redirect("/reviews");
    });
});

app.get("/payment", requireStaffRole("payment"), (req,res) => {
    const dishQuery = "SELECT id, dishname FROM dishdata";
    const orderQuery = "SELECT * FROM orders WHERE order_status = 1 ORDER BY order_id DESC";

    connection.query(dishQuery, (err, dishres) => {
        if (err) return res.status(500).send("Error in dish data.");

        let dishMap = {};
        dishres.forEach(dish => {
            dishMap[dish.id] = dish.dishname;
        });

        connection.query(orderQuery, (err, orderres) => {
            if (err) return res.status(500).send("Failed to get orders data");

            let orders = orderres.map(order => {
                let dishCount = {};
                let orderItem = order.dish_ids ? order.dish_ids.split(" ") : [];

                orderItem.forEach(id => {
                    dishCount[id] = (dishCount[id] || 0) + 1;
                });

                let dishes = Object.keys(dishCount).map(id => ({
                    name: dishMap[id] || `Unknown Dish (${id})`,
                    quantity: dishCount[id]
                }));

                return {
                    order_id: order.order_id,
                    tablenum: order.tablenum,
                    order_status: order.order_status,  
                    dishes: dishes
                };
            });
            res.render("payment.ejs",{orders});
        });
    });
});

app.post("/move", (req, res) => {
    let { email, passwd } = req.body;
    if (email == "kitchen@gmail.com" && passwd == "kitchen123") {
        req.session.staffRole = "kitchen";
        return res.redirect("/kitchen");
    } else if (email == "payment@gmail.com" && passwd == "payment123") {
        req.session.staffRole = "payment";
        return res.redirect("/payment");
    } else {
        res.status(401).send("Invalid Email ID or Password");
    }
});

app.patch("/reset-table", requireStaffRole("payment"), (req,res) => {
    const { order_id } = req.body;

    const getOrderQuery = "SELECT user_id, tablenum FROM orders WHERE order_id = ?";
    connection.query(getOrderQuery, [order_id], (err, orderResult) => {
        if (err) {
            return res.status(500).send("Error finding order.");
        }

        if (orderResult.length === 0) {
            return res.redirect("/payment");
        }

        const { tablenum } = orderResult[0];
        const deleteOrderQuery = "DELETE FROM orders WHERE order_id = ?";
        const freeTableQuery = "UPDATE tablestatus SET availability = 0 WHERE tablenumber = ?";

        connection.query(deleteOrderQuery, [order_id], (err) => {
            if (err) {
                return res.status(500).send("Error clearing order.");
            }

            connection.query(freeTableQuery, [tablenum], (err) => {
                if (err) {
                    return res.status(500).send("Error freeing table.");
                }

                res.redirect("/payment");
            });
        });
    });
});

app.patch("/reset-all-tables", requireStaffRole("payment"), (req, res) => {
    const deleteOrdersQuery = "DELETE FROM orders";
    const freeTablesQuery = "UPDATE tablestatus SET availability = 0";

    connection.query(deleteOrdersQuery, (err) => {
        if (err) {
            return res.status(500).send("Error clearing all orders.");
        }

        connection.query(freeTablesQuery, (err) => {
            if (err) {
                return res.status(500).send("Error freeing all tables.");
            }

            res.redirect("/payment");
        });
    });
});

app.patch("/clear-table", (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect("/");
    }

    const getTableQuery = "SELECT tablenum FROM userdata WHERE id = ?";
    connection.query(getTableQuery, [userId], (err, userResult) => {
        if (err) {
            return res.status(500).send("Error finding your table.");
        }

        if (userResult.length === 0) {
            req.session.destroy(() => res.redirect("/"));
            return;
        }

        const tableNum = userResult[0].tablenum;
        const deleteOrdersQuery = "DELETE FROM orders WHERE user_id = ?";
        const freeTableQuery = "UPDATE tablestatus SET availability = 0 WHERE tablenumber = ?";

        connection.query(deleteOrdersQuery, [userId], (err) => {
            if (err) {
                return res.status(500).send("Error clearing your order.");
            }

            connection.query(freeTableQuery, [tableNum], (err) => {
                if (err) {
                    return res.status(500).send("Error freeing your table.");
                }

                req.session.destroy(() => res.redirect("/"));
            });
        });
    });
});


app.get("/cart", requireCustomerTable, (req,res) => {
    const dishQuery = 'SELECT * FROM dishdata';
    const userId = req.session.userId;
    const orderPlaced = req.query.ordered === "1";

    if (!userId) {
        return connection.query(dishQuery, (err, dishres) => {
            if (err) {
                return res.status(500).send("Error in dish data.");
            }

            res.render("cart.ejs", { dish: dishres, dishMap: {} });
        });
    }

    let orderQuery=`SELECT dish_ids, order_status FROM orders WHERE user_id = ?`; 
    
    connection.query(dishQuery, (err, dishres) => {
        if (err) {
            return res.status(500).send("Error in dish data.");
        }
        
        connection.query(orderQuery, [userId], (err, orderres) => {
            if(err) {
                return res.status(500).send("Failed to get order data");
            }

            let dishMap={};
            let isOrderPlaced = orderPlaced;

            if(orderres.length > 0 && orderres[0].dish_ids){
                isOrderPlaced = orderPlaced || orderres[0].order_status === 1;
                let orderItem = orderres[0].dish_ids.split(" ");
                
                orderItem.forEach((id) => {
                    dishMap[id] = (dishMap[id] || 0)+1;
                });
            }

            res.render("cart.ejs",{dish:dishres,dishMap,isOrderPlaced});
        });
    });
});

app.get("/about",(req,res)=> {
    res.render("about.ejs");
});

app.post("/home",(req,res) => {
    let{user, email, phonenumber, table} = req.body;

    if(table>0 && table<6 ){
        const query = 'SELECT availability FROM tablestatus WHERE tablenumber = ?';

        connection.query(query, [table], (err, result) => {
            if (err) {
                return res.status(500).send('Database query error');
            }
            if(result.length === 0) {
                return res.status(400).send("Wrong table number in input");
            }

            if(result[0].availability === 0){
                const deleteStaleOrdersQuery = "DELETE FROM orders WHERE tablenum = ?";

                connection.query(deleteStaleOrdersQuery, [table], (err) => {
                    if (err) {
                        return res.status(500).send("Error preparing table for registration.");
                    }

                const insertQuery = 'INSERT INTO userdata (username, email, phonenumber, tablenum) VALUES (?, ?, ?, ?) RETURNING id';
                connection.query(insertQuery, [user, email, phonenumber, table], (err, insertResult) => {
                    if (err) {
                        return res.status(500).send("Error inserting user data.");
                    }

                    const userId = insertResult[0].id;
                    const updateQuery = 'UPDATE tablestatus SET availability = 1 WHERE tablenumber = ?';

                    connection.query(updateQuery, [table], (err) => {
                        if (err) {
                            const deleteUserQuery = "DELETE FROM userdata WHERE id = ?";
                            return connection.query(deleteUserQuery, [userId], () => {
                                res.status(500).send("Error updating table status.");
                            });
                        }

                        req.session.userId = userId;
                        res.render("home.ejs", {userId});
                    });
                });
                });
            }
            else{
                return res.status(400).send("Selected table is already occupied");
            }
        });
    }
    else
    {
        return res.status(400).send("Wrong table number in input");
    }
});

app.patch("/place-order", requireCustomerTable, (req,res) => {
    let userId=req.session.userId;

    const query = `UPDATE orders SET order_status = 1 WHERE user_id = ?`;

    connection.query(query, [userId], (err, result) => {
        if (err) {
            return res.status(500).send("Error updating order status.");
        }
        res.redirect("/cart?ordered=1");
    });
});
app.listen(port, () =>{
    console.log(`App is running at http://localhost:${port}`);
});
