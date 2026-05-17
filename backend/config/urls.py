from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from chat.views import serve_react

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('chat.urls')),
    re_path(r'^(?P<path>.*)$', serve_react, name='serve_react'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
