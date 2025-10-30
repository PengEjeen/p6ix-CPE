import yaml
from google import genai
from django.forms.models import model_to_dict
from cpe_module.models.quotation_models import Quotation


def extract_criteria_summary(prep, earth, frame):
    return {
        # PreparationWork
        "prep_residential_days": prep.residential_days,
        "prep_non_residential_days": prep.non_residential_days,
        "prep_units_under_2000": prep.units_under_2000,
        "prep_units_2000_3000": prep.units_2000_3000,
        "prep_units_over_3000": prep.units_over_3000,
        "prep_floors_under_10": prep.floors_under_10,
        "prep_floors_under_20": prep.floors_under_20,
        "prep_floors_under_45": prep.floors_under_45,
        "prep_floors_over_46": prep.floors_over_46,

        # Earthwork
        "earth_support_earth_anchor": earth.support_earth_anchor,
        "earth_support_raker": earth.support_raker,
        "earth_support_strut": earth.support_strut,
        "earth_production_cip": earth.production_cip,
        "earth_production_dwall": earth.production_dwall,
        "earth_production_hpile": earth.production_hpile,
        "earth_excavation_soil": earth.excavation_soil,
        "earth_excavation_weathered": earth.excavation_weathered,
        "earth_haul_direct": earth.haul_direct,
        "earth_haul_cram": earth.haul_cram,
        "earth_surcharge_school": earth.surcharge_school,
        "earth_surcharge_residential": earth.surcharge_residential,
        "earth_rcd_2000": earth.rcd_2000,
        "earth_prd_1000": earth.prd_1000,

        # FrameWork
        "frame_change_transfer": frame.change_transfer,
        "frame_change_refuge": frame.change_refuge,
        "frame_change_piloti": frame.change_piloti,
        "frame_change_podium": frame.change_podium,
        "frame_change_sky": frame.change_sky,
        "frame_change_cycle_time": frame.change_cycle_time,
        "frame_form_tc": frame.form_tc,
        "frame_form_hydraulic": frame.form_hydraulic,
        "frame_reverse_excavation": frame.reverse_excavation,
    }

def extract_calc_summary(overview, work, prep, earth, frame):
    return {
        # ConstructionOverview
        "overview_client_type": overview.client_type,
        "overview_building_use": overview.building_use,
        "overview_construction_type": overview.construction_type,
        "overview_location": overview.location,
        "overview_nearby_env": overview.nearby_env,
        "overview_basement_floors": overview.basement_floors,
        "overview_ground_floors": overview.ground_floors,
        "overview_total_units": overview.total_units,
        "overview_total_buildings": overview.total_buildings,
        "overview_total_floor_area": overview.total_floor_area,

        # WorkCondition
        "work_earthwork_type": work.earthwork_type,
        "work_framework_type": work.framework_type,
        "work_earthwork_utilization": work.earthwork_utilization_input,
        "work_framework_utilization": work.framework_utilization_input,

        # PreparationPeriod
        "prep_fixed_months": prep.preparation_fixed_months,
        "prep_input_days": prep.preparation_input_days,
        "prep_household": prep.household,
        "prep_is_home": prep.is_home,
        "prep_floors_under_months": prep.floors_under_months,

        # EarthworkInput
        "earth_is_sunta": earth.is_sunta,
        "earth_reverse_method": earth.reverse_excavation_months,
        "earth_retention_method": earth.earth_retention_method,
        "earth_support_method": earth.support_method,
        "earth_total_volume": earth.total_earth_volume,
        "earth_soil_ratio": earth.soil_ratio,
        "earth_weathered_ratio": earth.weathered_ratio,
        "earth_soft_rock_ratio": earth.soft_rock_ratio,
        "earth_hard_rock_ratio": earth.hard_rock_ratio,
        "earth_designated_method": earth.designated_method,
        "earth_designated_diameter": earth.designated_diameter,
        "earth_designated_depth": earth.designated_drilling_depth,
        "earth_parallel_retention": earth.parallel_retention,
        "earth_parallel_excavation": earth.parallel_excavation,

        # FrameWorkInput
        "frame_base_thickness": frame.base_thickness,
        "frame_is_TC": frame.is_TC,
        "frame_cycle_time": frame.cycle_time,
    }

def gemini_runner(
    quotation: Quotation,
    prep_criteria,
    earth_criteria,
    frame_criteria,
    overview,
    work,
    prep_calc,
    earth_calc,
    frame_calc,
) -> str:
    """
    Gemini AI 분석 실행 (Quotation + Calc + Criteria)
    """

    try:
        # 기본 견적서 데이터
        data = model_to_dict(quotation)
        total_days = sum([
            data.get("preparation_period", 0),
            data.get("earth_retention", 0),
            data.get("support", 0),
            data.get("excavation", 0),
            data.get("designated_work", 0),
            data.get("base_framework", 0),
            data.get("basement_framework", 0),
            data.get("ground_framework", 0),
            data.get("finishing_work", 0),
            data.get("additional_period", 0),
            data.get("cleanup_period", 0),
        ])
        data["total_days"] = total_days
        safe_data = {k: (v if v is not None else "") for k, v in data.items()}

        # 기준(Criteria) + 입력(Calc) 데이터 요약
        criteria_summary = extract_criteria_summary(prep_criteria, earth_criteria, frame_criteria)
        calc_summary = extract_calc_summary(overview, work, prep_calc, earth_calc, frame_calc)

        # None 값 안전 처리
        criteria_safe = {k: (v if v is not None else "") for k, v in criteria_summary.items()}
        calc_safe = {k: (v if v is not None else "") for k, v in calc_summary.items()}

        # 모든 데이터 병합
        merged_data = {**safe_data, **calc_safe, **criteria_safe}

        # 프롬프트 로드 및 포맷팅
        with open("cpe_module/utils/templates/gemini_prompt.yaml", "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        base_prompt = config["prompt"]

        # format()으로 모든 변수 채우기
        prompt_filled = base_prompt.format(**merged_data)

        # Gemini API 호출
        GEMINI_API_KEY = "AIzaSyCd5AYnBkb2RV2TCjakgtyoRmJ3e3XFDjI"
        client = genai.Client(api_key=GEMINI_API_KEY)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_filled,
        )

        result_text = response.text or "(AI 분석 실패: 응답 없음)"
        return result_text

    except Exception as e:
        return f"(AI 분석 중 오류 발생: {e})"