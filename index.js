import dotenv from "dotenv";
dotenv.config();
import express from "express";
import  connectDB  from './connect.js';
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { upload } from "./middlewares/upload.js";
import User from "./models/user.js";
import { isLoggedIn } from "./middlewares/auth.js";
import path from "path";
import { Blog } from "./models/blog.js";


await connectDB(process.env.MONGO_URL)


const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = "8299877735";

// ⛓️ Middlewares
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

app.use(async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded._id).select("fullName email");
    req.user = user;
  } catch (err) {
    req.user = null;
  }

  next();
});

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});



// 🎨 View engine setup
app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

// 📄 Routes
app.get("/", async (req, res) => {
  const blogs = await Blog.find().populate("author").sort({ createdAt: -1 });
  res.render("home", { blogs, query: null });
});

app.get("/signin", (req, res) => {
  if (req.user) return res.redirect("/");
  res.render("signin", { error: null }); // default value
});


app.get("/signup", (req, res) => {
  if (req.user) return res.redirect("/");
  res.render("signup",{ error: null });
});

app.get("/blogs/new", isLoggedIn, (req, res) => {
  res.render("blog-new");
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});


app.get("/contact", (req, res) => {
  res.render("contact");
});


app.get("/blogs/:id", async (req, res) => {
  const blog = await Blog.findById(req.params.id)
    .populate("author comments.user");
  
  const userId = req.user ? req.user._id.toString() : null; // if you’re using JWT middleware

  res.render("blog-details", {
    blog,
    currentUserId: userId,  // ✅ Pass to template
    backTarget: req.get("Referrer") || "/" // optional if you're using "← Back" link
  });
});


app.get("/search", async (req, res) => {
  const searchQuery = req.query.q;
  const blogs = await Blog.find({
    title: { $regex: searchQuery, $options: "i" }
  }).populate("author");

  res.render("home", { blogs, query: searchQuery });
});

app.get("/blogs/:id/edit", isLoggedIn, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog || blog.author.toString() !== req.user._id.toString()) {
    return res.status(403).send("Unauthorized");
  }
  res.render("blog-edit", { blog });
});

app.get("/myblogs", isLoggedIn, async (req, res) => {
  try {
    const blogs = await Blog.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .populate("author");

    res.render("my-blogs", { blogs });
  } catch (err) {
    console.log(err);
    res.status(500).send("Something went wrong.");
  }
});

// 🔐 Signup
app.post("/signup", async (req, res) => {
  const { fullName, email, password } = req.body;

   try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render("signup", { error: "Email already exists" });
    }

  
    const user = await User.create({ fullName, email, password });
    const token = jwt.sign({ _id: user._id, email: user.email }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/");
  } catch (err) {
    console.error("❌ Signup error:", err.message);
    res.status(400).send("Signup failed");
  }
});

// 🔐 Signin
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).render("signin", { error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).render("signin", { error: "Invalid email or password" });
    }

    const token = jwt.sign({ _id: user._id, email: user.email }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/");
  } catch (err) {
    console.error("❌ Signin error:", err);
    res.status(500).render("signin", { error: "Signin failed. Please try again." });
  }
});


// ➕ Create blog
app.post("/blogs", upload.single("image"), isLoggedIn, async (req, res) => {
  const { title, content } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const newBlog = new Blog({
    title,
    content,
    author: req.user._id,
    image: imagePath
  });

  await newBlog.save();
  res.redirect("/myblogs");
});

// ✏️ Edit blog
app.post("/blogs/:id/edit", isLoggedIn, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog || blog.author.toString() !== req.user._id.toString()) {
    return res.status(403).send("Unauthorized");
  }

  blog.title = req.body.title;
  blog.content = req.body.content;
  await blog.save();
  res.redirect(`/blogs/${blog._id}`);
});

// ❌ Delete blog
app.post("/blogs/:id/delete", isLoggedIn, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog || blog.author.toString() !== req.user._id.toString()) {
    return res.status(403).send("Unauthorized");
  }

  await Blog.findByIdAndDelete(blog._id);
  res.redirect("/");
});

// 💬 Post comment
app.post("/blogs/:id/comment", isLoggedIn, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return res.status(404).json({ error: "Blog not found" });

  const comment = {
    user: req.user._id,
    content: req.body.comment
  };

  blog.comments.push(comment);
  await blog.save();

  const user = await User.findById(req.user._id);

  res.json({
    username: user.fullName,
    content: req.body.comment
  });
});

// ❤️ Like / Unlike blog
app.post("/blogs/:id/like", isLoggedIn, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    const userId = req.user._id;

    const alreadyLiked = blog.likes.includes(userId);
    if (alreadyLiked) {
      blog.likes.pull(userId);
    } else {
      blog.likes.push(userId);
    }

    await blog.save();

    res.json({ likesCount: blog.likes.length });
  } catch (err) {
    res.status(500).json({ error: "Error updating like." });
  }
});

// 🚀 Start server
app.listen(PORT, () => console.log(`🌍 SERVER STARTED ON PORT: ${PORT}`));
