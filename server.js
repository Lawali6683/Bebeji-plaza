const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const schedule = require('node-schedule');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const dotenv = require('dotenv');
const webpush = require('web-push');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// MongoDB setup
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Models
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  shopNumber: String,
  phoneNumber: String,
  businessName: String,
  fullName: String,
  verified: Boolean,
  otp: String,
  faceImage: String,
  shopImage: String
});

const postSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  content: String,
  media: String,
  timestamp: Date
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Register route
app.post('/register', (req, res) => {
  const { email, password, shopNumber, phoneNumber, businessName, fullName } = req.body;
  const otp = crypto.randomBytes(3).toString('hex');
  const hashedPassword = bcrypt.hashSync(password, 10);

  const newUser = new User({
    email,
    password: hashedPassword,
    shopNumber,
    phoneNumber,
    businessName,
    fullName,
    verified: false,
    otp
  });

  newUser.save()
    .then(user => {
      transporter.sendMail({
        to: email,
        subject: 'OTP Verification',
        text: `Hello ${fullName} from Bebeji Plaza phone center. This is your OTP code: ${otp}`
      });
      res.json({ success: true, message: 'Registration successful. Check your email for your OTP verify email code.' });
    })
    .catch(error => res.status(500).json({ success: false, message: 'Error during registration.' }));
});

// OTP verification route
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  User.findOne({ email })
    .then(user => {
      if (!user) {
        return res.json({ success: false, message: 'This email address is not registered.' });
      }

      if (user.otp !== otp) {
        return res.json({ success: false, message: 'The OTP verify code is not correct, check your email, and tying again.' });
      }

      user.verified = true;
      user.otp = null;
      return user.save();
    })
    .then(user => res.json({ success: true, message: 'Email verification successful.' }))
    .catch(error => res.status(500).json({ success: false, message: 'Error during verification.' }));
});

// Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  User.findOne({ email })
    .then(user => {
      if (!user) {
        return res.json({ success: false, message: 'This email address is not registered on any account.' });
      }

      if (!user.verified) {
        return res.json({ success: false, message: 'You need to verify your email first.' });
      }

      const passwordMatch = bcrypt.compareSync(password, user.password);
      if (!passwordMatch) {
        return res.json({ success: false, message: 'The password you entered is not correct.' });
      }

      res.json({ success: true, message: 'Successfully logged in your account.' });
    })
    .catch(error => res.status(500).json({ success: false, message: 'Error during login.' }));
});

// Forgot Password route
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  User.findOne({ email })
    .then(user => {
      if (!user) {
        return res.json({ success: false, message: 'This email address is not registered on any account, you can start register.' });
      }

      const newPassword = crypto.randomBytes(4).toString('hex');
      user.password = bcrypt.hashSync(newPassword, 10);

      return user.save()
        .then(user => {
          transporter.sendMail({
            to: email,
            subject: 'Password New Recovery',
            text: `Hello, your new password is: ${newPassword}`
          });

          res.json({ success: true, message: 'A new password has been sent to your email.' });
        });
    })
    .catch(error => res.status(500).json({ success: false, message: 'Error during password recovery.' }));
});

// Profile route
app.get('/profile', (req, res) => {
  const userId = req.query.userId;

  User.findById(userId)
    .then(user => res.json(user))
    .catch(error => res.status(500).send('Error fetching user profile'));
});

// Update profile images
app.post('/update-profile-image', upload.single('image'), (req, res) => {
  const { userId, type } = req.body;
  const imagePath = `/uploads/${req.file.filename}`;
  const updateField = type === 'shop' ? 'shopImage' : 'faceImage';

  User.findByIdAndUpdate(userId, { [updateField]: imagePath }, { new: true })
    .then(user => res.json({ message: 'Profile image updated successfully', user }))
    .catch(error => res.status(500).send('Error updating profile image'));
});

// Post creation route
app.post('/create-post', upload.single('media'), (req, res) => {
  const { userId, content } = req.body;
  const mediaPath = req.file ? `/uploads/${req.file.filename}` : null;
  const newPost = new Post({ userId, content, media: mediaPath, timestamp: new Date() });

  newPost.save()
    .then(post => {
      io.emit('newPost', post);
      res.status(201).send('Post created successfully');
    })
    .catch(error => res.status(500).send('Error creating post'));
});

// Automatically delete posts older than one year
const deleteOldPosts = () => {
  const oneYearAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1));

  Post.deleteMany({ timestamp: { $lt: oneYearAgo } })
    .then(() => console.log('Old posts deleted'))
    .catch(err => console.log('Error deleting old posts:', err));
};

// Schedule the deletion job to run daily
schedule.scheduleJob('0 0 * * *', deleteOldPosts);

// Send notifications every Friday at 2 PM
const sendFridayNotifications = () => {
  User.find()
    .then(users => {
      users.forEach(user => {
        transporter.sendMail({
          to: user.email,
          subject: 'Happy Juma\'a!',
          text: `Hello ${user.fullName}, from Bebeji Plaza, Phone Center, Leaders and Developer. Happy Juma'a! Don't forget to check out our latest products.`,
          attachments: [{
            filename: 'icon.png',
            path: path.join(__dirname, 'public', 'icon.png'),
            cid: 'icon' // same cid value as in the html img src
          }]
        });
      });
    })
    .catch(error => console.log('Error sending Friday notifications:', error));
};

// Schedule the Friday notification job
schedule.scheduleJob('0 14 * * 5', sendFridayNotifications);

// Send notifications for popular posts twice a day
const sendPostNotifications = () => {
  Post.aggregate([
    { $group: { _id: "$userId", count: { $sum: 1 } } }
  ])
    .then(results => {
      const frequentVisitors = results.filter(result => result.count >= 2);

      frequentVisitors.forEach(visitor => {
        User.findById(visitor._id)
          .then(user => {
            if (user) {
              transporter.sendMail({
                to: user.email,
                subject: 'BEBEJI PLAZA Notification',
                text: `Dear ${user.fullName},

We noticed that you've visited Bebeji Plaza twice today. Don't miss out on the latest updates and offers from us!`,
            attachments: [{
              filename: 'icon.png',
              path: path.join(__dirname, 'public', 'icon.png'),
              cid: 'ipIcon'
            }],
            html: `<p>Dear ${user.fullName},</p><p>We noticed that you've visited Bebeji Plaza twice today. Don't miss out on the latest updates and offers from us!</p><img src="cid:ipIcon" />`
          });
        }
      });
    });
  })
  .catch(error => console.log('Error sending post notifications:', error));
};

// Schedule the post notification job to run at 10 AM and 6 PM daily
schedule.scheduleJob('0 10,18 * * *', sendPostNotifications);

// Real-time communication for new posts
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Store.html
// Route to display store page
app.get('/store', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'store.html'));
});

// Route to handle adding a product to the store
app.post('/store/add-product', upload.single('image'), async (req, res) => {
  const { description, price, owner } = req.body;
  const imageUrl = `/uploads/${req.file.filename}`;

  const newProduct = new Product({
    description,
    price,
    imageUrl,
    owner
  });

  try {
    await newProduct.save();
    res.redirect('/store');
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send('Error adding product');
  }
});

// Route to fetch all products for display on the store page
app.get('/store/products', async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Error fetching products');
  }
});

// Route to delete a product
app.post('/store/delete-product', async (req, res) => {
  try {
    const product = await Product.findById(req.body.id);
    if (product) {
      fs.unlinkSync(path.join(__dirname, 'public', product.imageUrl)); // Delete image from server
      await product.remove();
      res.redirect('/store');
    } else {
      res.status(404).send('Product not found');
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).send('Error deleting product');
  }
});
