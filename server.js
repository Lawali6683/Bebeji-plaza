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
app.use(express.static(path.join(__dirname, 'docs')));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'dosc/uploads');
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

const productSchema = new mongoose.Schema({
  description: String,
  price: Number,
  imageUrl: String,
  owner: String,
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Product = mongoose.model('Product', productSchema);

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
        text: `Hello ${fullName} from Bebeji Plaza phone center. This is your OTP verify email code: ${otp}`
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
        return res.json({ success: false, message: 'The OTP verify code is not correct, check your email, and trying again.' });
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
          text: `Assalamu alaikum, ${user.fullName}, A yau da rana mai albarka ta Juma'a, muna fatan kuna cikin koshin lafiya da farin ciki. Kasuwancin ku yana matukar muhimmanci a gare mu a Bebeji Plaza, kuma muna farin cikin ganin yadda masu ziyartar shafin ku ke karuwa kowace rana. Kada ku bari wannan damar ta wuce ku; ku dora sababbin kayayyakin ku domin cimma babbar nasara!. Muna godiya da kasancewa tare da mu, daga Bebeji Plaza - Cibiyar Kasuwancin ku.`,
          attachments: [{
            filename: 'icon.png',
            path: path.join(__dirname, 'docs', 'icon.png'),
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
                subject: 'BEBEJI PLAZA, your business center',
                text: `Barka ${user.fullName}',

'Masu ziyartar shafin ku suna matukar son ganin sabbin kayayyaki masu kyau. Don haka, yana da muhimmanci ku sabunta shafin ku akai-akai da kayan zamani da masu kyau. Wannan zai taimaka wajen jan hankalin masu siya da kuma kara yawan kwastomomi. Koyaushe ku kasance a sahun gaba wajen gabatar da sabbin abubuwa!`,
                attachments: [{
                  filename: 'icon.png',
                  path: path.join(__dirname, 'docs', 'icon.png'),
                  cid: 'ipIcon'
                }],
                html: `<p>Barka ${user.fullName},</p><p>Masu ziyartar shafin ku suna matukar son ganin sabbin kayayyaki masu kyau. Don haka, yana da muhimmanci ku sabunta shafin ku akai-akai da kayan zamani da masu kyau. Wannan zai taimaka wajen jan hankalin masu siya da kuma kara yawan kwastomomi. Koyaushe ku kasance a sahun gaba wajen gabatar da sabbin abubuwa!</p><img src="cid:ipIcon" />`
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

// Route to serve the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} with 3000 posts`);
});
