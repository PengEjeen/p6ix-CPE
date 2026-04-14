from django.urls import path
from . import views

urlpatterns = [
    path('weather-stations/', views.get_weather_stations, name='weather-stations'),
    path('holidays/', views.get_holidays, name='holidays'),
]
