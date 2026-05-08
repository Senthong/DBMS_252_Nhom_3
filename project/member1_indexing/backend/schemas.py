from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class OrderBase(BaseModel):
    customer_id: str
    order_status: str

class OrderCreate(OrderBase):
    order_id: str
    # Sử dụng datetime.now() mặc định ở backend nếu user không gửi lên
    order_purchase_timestamp: Optional[datetime] = None

class OrderUpdate(BaseModel):
    order_status: str

class OrderResponse(OrderBase):
    order_id: str
    order_purchase_timestamp: Optional[datetime]
    
    class Config:
        from_attributes = True