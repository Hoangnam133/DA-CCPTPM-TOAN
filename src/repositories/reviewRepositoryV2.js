const reviewModel = require('../models/reviewModel')
const {BadRequestError, NotFoundError} = require('../core/errorResponse')
const productModel = require('../models/productModel')
const orderModel = require('../models/orderModel')
const {toObjectId} = require('../utils/index')
// dánh sách đơn hàng đã đánh giá
const orderHasBeenReviewed = async(user)=>{
    const orders = await orderModel.find({
        order_userId: user._id,
        order_status: 'completed'
    })
    if (!orders) {
        throw new NotFoundError("Bạn chưa có đơn hàng nào")
    }
    const orderIds = orders.map(order=>order._id)
    const reviews = await reviewModel.find({
        review_order_id: { $in: orderIds },
        review_isDeleted: false
    }).sort({createdAt: -1})
    if (!reviews) {
        throw new NotFoundError("Bạn chưa có đánh giá nào")
    }
    const hasBeenReviewed = await orderModel.find({
        order_userId: user._id,
        order_status: 'completed',
        _id: {$in: reviews.map(review=> review.review_order_id)}
    })
    return hasBeenReviewed
}
// danh sách đơn hàng chưa đánh giá
 const orderNotBeenReviewed = async(user)=>{
    const orders = await orderModel.find({
        order_userId: user._id,
        order_status: 'completed'
    })
    if (!orders) {
        throw new NotFoundError("Bạn chưa có đơn hàng nào")
    }
    const orderIds = orders.map(order=>order._id)
    const reviews = await reviewModel.find({
        review_order_id: { $in: orderIds },
        review_isDeleted: false,
        review_user_id: user._id
    })
    if (reviews.length === orders.length) {
        throw new NotFoundError("bạn đã đánh giá tất cả đơn hàng")
    }
    const notBeenReviewedOrderIds = orders.filter(order=> order._id.toString()!== reviews.map(review=>review.review_order_id.toString()))
    const notBeenReviewedOrders = await orderModel.find({
        _id: { $in: notBeenReviewedOrderIds },
        order_status: 'completed'
    }).sort({createdAt: -1})
    if (!notBeenReviewedOrders) {
        throw new NotFoundError("bạn chưa có đơn hàng nào được đánh giá")
    }
    return notBeenReviewedOrders
}
// cập nhật đánh giá cho sản phẩm
const updateRatingProduct = async ({ product_id, rating }) => {
  
    const foundProduct = await productModel.findById(product_id);
    

    if (!foundProduct) {
        throw new NotFoundError("có một chút sự cố. Vui lòng thử lại sau");
    }

    const oldRating = foundProduct.product_ratingAverage;
    const oldCountRating = foundProduct.review_count;

    if (isNaN(rating) || rating < 1 || rating > 5) {
        throw new BadRequestError("đánh giá phải nằm trong từ 1-5 sao");
    }

    if (isNaN(oldCountRating)) {
        throw new Error("đánh giá không hợp lệ");
    }

    const newCountRating = oldCountRating + 1;
    const newRating = (oldRating * oldCountRating + rating) / newCountRating;

    const updateProduct = await productModel.findByIdAndUpdate(product_id, {
        $set: {
            product_ratingAverage: Math.round(newRating * 10) / 10, 
            review_count: newCountRating 
        }
    }, { new: true }); 

    if (!updateProduct) {
        throw new BadRequestError("có một chút sự cố, vui lòng thử lại sau");
    }

    return updateProduct;
};

const getReviewById = async(review_id) => {
    const findReview = await reviewModel.findById(review_id)
    .populate('review_order_id')
    if (!findReview) {
        throw new NotFoundError("có một chút sự cố. Vui lòng thử lại sau")
    }
    return findReview
}
// tạo đánh giá
const createReview = async({payload, order_id, user})=>{
    const orders = await orderModel.findOne({
        order_userId: user._id,
        order_status: 'completed',
        _id: order_id
    })
    if (!orders) {
        throw new NotFoundError("có một chút sự cố. Vui lòng thử lại sau")
    }
    const existingReview = await reviewModel.findOne({
        review_order_id: orders._id
    })
    if (existingReview) {
        throw new BadRequestError("Bạn đã đánh giá đơn hàng này rồi")
    }
    const productIds = orders.order_product.map(item => item.product_id)
    const createReview = await reviewModel.create({
        review_user_id: user._id,
        review_content: payload.review_content,
        review_rating: payload.review_rating,
        review_order_id: order_id,
        review_isDeleted: false
    })
    if (createReview) {
       for(let product of productIds){
            const updateProduct = await updateRatingProduct({product_id: product, rating: payload.review_rating})
            if (!updateProduct) {
               await reviewModel.findByIdAndDelete(createReview._id)
               break
            }
       }
    }
    else{
        throw new BadRequestError("có một chút sự cố. Vui lòng thử lại sau")
    }
    return createReview
}
const listReviews = async(user)=>{
    const reviews = await reviewModel.find({
        review_user_id: user._id,
        review_isDeleted: false
    }).populate({path:"review_order_id",  select:'order_trackingNumber'}).sort({createdAt: -1})
    if (!reviews) {
        throw new NotFoundError("bạn chưa đánh giá đơn hàng nào")
    }
    return reviews
}
module.exports = {
    orderHasBeenReviewed,
    orderNotBeenReviewed,
    createReview,
    getReviewById,
    listReviews
}

