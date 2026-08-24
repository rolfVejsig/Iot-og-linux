const express = require("express");
const clientsRouter = require("./routes/clients");

const app = express();

app.use(express.json());

app.use("/clients", clientsRouter);

app.use(express.static("public"));

// 200 OK
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Server is online"
    });
});

// 404 Not Found
app.use((req, res) => {
    res.status(404).json({
        message: "No page found"
    });
});


app.listen(3000, () => {
    console.log("Server kører på port 3000");
});