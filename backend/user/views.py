from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status, permissions, views, generics
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        print("[DEBUG] 요청 사용자:", self.request.user)
        print("[DEBUG] 요청 메서드:", self.request.method)
        return self.request.user

    def update(self, request, *args, **kwargs):
        print("[DEBUG] 요청 데이터:", request.data)
        response = super().update(request, *args, **kwargs)
        print("[DEBUG] 응답 데이터:", response.data)
        return response

    def handle_exception(self, exc):
        from rest_framework.response import Response
        from rest_framework import status
        import traceback

        print("[ERROR] 예외 발생:", exc)
        traceback.print_exc()

        if hasattr(exc, "detail"):
            print("[ERROR DETAIL]", exc.detail)
        return super().handle_exception(exc)


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response(status=status.HTTP_400_BAD_REQUEST)
