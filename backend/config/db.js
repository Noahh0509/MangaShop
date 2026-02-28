import mongoose from "mongoose";

export const connectDB = async () => {
    try{
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Kết nối DB thành công");
    }catch(error){
        console.log("Kết nối DB thất bại", error);
        process.exit(1);
    }
};
