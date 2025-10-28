from django.contrib import admin
from .models.project_models import Project
from .models.calc_models import *
from .models.criteria_models import *
from .models.estimate_models import *
from .models.operating_rate_models import *
from .models.quotation_models import Quotation

admin.site.register(Project)
admin.site.register(ConstructionOverview)
admin.site.register(WorkCondition)
admin.site.register(PreparationPeriod)
admin.site.register(EarthworkInput)
admin.site.register(FrameWorkInput)
admin.site.register(WorkScheduleWeight)
admin.site.register(PreparationWork)
admin.site.register(Earthwork)
admin.site.register(FrameWork)
admin.site.register(Quotation)