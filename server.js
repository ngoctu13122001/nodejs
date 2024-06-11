const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const mongoose = require('mongoose');

// Thiết lập kết nối với MongoDB Atlas
mongoose.connect('mongodb+srv://ntuuu:WKXMrbadN31Kq34h@nguyenngoctu.i1bpmai.mongodb.net/notify?retryWrites=true&w=majority')
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Error connecting to MongoDB Atlas:', err));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://fcm.googleapis.com/v1/projects/qlcv-521e6/messages:send'
});

const app = express();
const port = 3000;

app.use(express.json());
// Sử dụng middleware CORS
app.use(cors());

// Định nghĩa Schema cho collection users
const userSchema = new mongoose.Schema({
    user_name: String,
    tokens: String // Updated to handle a single token as a string
});

// Tạo model từ Schema
const User = mongoose.model('User', userSchema);

// Hàm để lưu giá trị sau khi đăng nhập thành công từ Flutter vào MongoDB Atlas
app.post('/saveUserToken', async (req, res) => {
    console.log('Received a request from flutter:', req.body);
    const { user_name, tokens } = req.body;
    try {
        const existingUser = await User.findOne({ user_name });

        if (existingUser) {
            existingUser.tokens = tokens;
            await existingUser.save();
            console.log('Updated tokens for user:', user_name);
            res.status(200).json({ message: 'Tokens updated successfully' });
        } else {
            const newUser = new User({
                user_name,
                tokens
            });
            await newUser.save();
            console.log('Saved tokens for new user:', user_name);
            res.status(200).json({ message: 'Tokens saved successfully' });
        }
    } catch (error) {
        console.error('Error saving user token:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/sendNotification', async (req, res) => {
    const { title, content, userIds } = req.body; // Nhận mảng userIds
    console.log('Received a request from ReactJS:', req.body);

    try {
        let tokens = [];

        for (const userId of userIds) {
            // Lấy token từ MongoDB dựa trên user_name
            const userToken = await getUserTokenByUserName(userId);
            if (userToken) {
                tokens.push(userToken);
            } else {
                console.log(`User token not found for userId: ${userId}`);
            }
        }

        if (tokens.length > 0) {
            // Tạo thông điệp notification
            const message = {
                notification: {
                    title: title,
                    body: content,
                },
                tokens: tokens // Gửi mảng tokens
            };
            // Gửi thông báo cho người dùng
            const response = await admin.messaging().sendMulticast(message);
            console.log('Successfully sent message:', response);
            res.status(200).json({ message: 'Notification sent successfully' });
        } else {
            console.log('No tokens found for provided userIds');
            res.status(404).json({ message: 'No tokens found for provided userIds' });
        }
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Error sending message' });
    }
});

// Hàm để lấy token của người dùng từ MongoDB dựa trên user_name
async function getUserTokenByUserName(userId) {
    try {
        // Truy vấn cơ sở dữ liệu để lấy token dựa trên user_name
        const user = await User.findOne({ user_name: userId });
        if (user) {
            return user.tokens;
        } else {
            console.log('User not found');
            return null;
        }
    } catch (error) {
        console.error('Error getting user token:', error);
        throw error;
    }
}

app.get('/', (req, res) => {
    res.send('Server nodejs firebase');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});