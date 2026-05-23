from django.urls import path
from . import views

urlpatterns = [
    path('api/login/', views.api_login, name='api_login'),
    path('api/check-auth/', views.api_check_auth, name='api_check_auth'),
    path('api/get-user-status/', views.get_user_status, name='get_user_status'),
    path('api/get-new-messages/', views.get_new_messages, name='get_new_messages'),
    path('api/upload-image/', views.api_upload_image, name='api_upload_image'),
    path('logout/', views.logout_view, name='logout'),
]
