import { useCallback, useState } from "react";
import {
    fetchScheduleItems,
    saveScheduleData,
    initializeDefaultItems
} from "../api/cpe_all/construction_schedule";
import { detailOperatingRate } from "../api/cpe/operating_rate";
import { fetchCIPResults, fetchCIPStandard } from "../api/cpe_all/cip_basis";
import { fetchPileResults, fetchPileStandard } from "../api/cpe_all/pile_basis";
import { fetchBoredPileResults, fetchBoredPileStandard } from "../api/cpe_all/bored_pile_basis";
import { detailProject } from "../api/cpe/project";
import { detailWorkCondition } from "../api/cpe/calc";
import toast from "react-hot-toast";

const DEFAULT_SCHEDULE_ITEMS = [];

/**
 * Custom hook for loading schedule data
 * @param {string} projectId - Project ID
 * @param {Function} setStoreItems - Store setter for items
 * @param {Function} setStoreOperatingRates - Store setter for operating rates
 * @param {Function} setStoreLinks - Store setter for links
 * @param {Function} setStoreWorkDayType - Store setter for work day type
 * @returns {Object} { loading, loadData, cipResult, pileResult, boredResult, cipStandards, pileStandards, boredStandards, startDate, projectName, containerId, setContainerId }
 */
export const useScheduleData = (projectId, setStoreItems, setStoreOperatingRates, setStoreLinks, setStoreWorkDayType, setStoreSubTasks) => {
    const [loading, setLoading] = useState(true);
    const [cipResult, setCipResult] = useState([]);
    const [pileResult, setPileResult] = useState([]);
    const [boredResult, setBoredResult] = useState([]);
    const [cipStandards, setCipStandards] = useState([]);
    const [pileStandards, setPileStandards] = useState([]);
    const [boredStandards, setBoredStandards] = useState([]);
    const [startDate, setStartDate] = useState("");
    const [projectName, setProjectName] = useState("");
    const [containerId, setContainerId] = useState(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [
                fetchedData,
                rateData,
                cipData,
                pileData,
                boredData,
                projectData,
                cipStdData,
                pileStdData,
                boredStdData
            ] = await Promise.all([
                fetchScheduleItems(projectId),
                detailOperatingRate(projectId),
                fetchCIPResults(projectId),
                fetchPileResults(projectId),
                fetchBoredPileResults(projectId),
                detailProject(projectId),
                fetchCIPStandard(),
                fetchPileStandard(),
                fetchBoredPileStandard()
            ]);

            // Handle Initial Init
            let scheduleItems = fetchedData.items;
            let scheduleLinks = fetchedData.links || [];
            let scheduleSubTasks = fetchedData.sub_tasks || fetchedData.subTasks || [];
            let currentContainerId = fetchedData.containerId;

            if (!currentContainerId || !scheduleItems || scheduleItems.length === 0) {
                // Initialize if empty (Backend)
                try {
                    await initializeDefaultItems(projectId);
                    const refetched = await fetchScheduleItems(projectId);
                    scheduleItems = refetched.items;
                    scheduleLinks = refetched.links || [];
                    scheduleSubTasks = refetched.sub_tasks || refetched.subTasks || [];
                    currentContainerId = refetched.containerId;
                } catch (e) {
                    console.error("Backend Init Failed, using local fallback");
                }

                // If STILL empty (API failure or weirdness), use Local Fallback
                if (!scheduleItems || scheduleItems.length === 0) {
                    console.warn("Using Local Fallback Data");
                    scheduleItems = DEFAULT_SCHEDULE_ITEMS;
                    scheduleLinks = [];
                    scheduleSubTasks = [];
                    // Try to save it immediately if we have a containerId, or wait for user save
                    if (currentContainerId) {
                        saveScheduleData(currentContainerId, { items: scheduleItems, links: scheduleLinks, sub_tasks: scheduleSubTasks }).catch(console.error);
                    }
                }
            }

            // Ensure proper calculation on load
            setContainerId(currentContainerId);

            // Store Init
            setStoreOperatingRates(rateData);
            // Store Init
            setStoreOperatingRates(rateData);

            // CRIMTICAL FIX: Deduplicate items based on ID to prevent rendering issues
            // Backend might return duplicates or previous logic might have piled them up locally
            const uniqueItems = [];
            const seenIds = new Set();
            if (Array.isArray(scheduleItems)) {
                scheduleItems.forEach(item => {
                    if (!seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        uniqueItems.push(item);
                    }
                });
            }

            console.log(`[LoadData] Loaded ${scheduleItems?.length} items, deduped to ${uniqueItems.length}`);

            setStoreItems(uniqueItems); // Will calculate in store
            setStoreLinks(scheduleLinks);
            if (setStoreSubTasks) {
                setStoreSubTasks(scheduleSubTasks);
            }

            const cipList = Array.isArray(cipData) ? cipData : (cipData.results || []);
            const pileList = Array.isArray(pileData) ? pileData : (pileData.results || []);
            const boredList = Array.isArray(boredData) ? boredData : (boredData.results || []);
            setCipResult(cipList);
            setPileResult(pileList);
            setBoredResult(boredList);
            setCipStandards(Array.isArray(cipStdData) ? cipStdData : (cipStdData.results || []));
            setPileStandards(Array.isArray(pileStdData) ? pileStdData : (pileStdData.results || []));
            setBoredStandards(Array.isArray(boredStdData) ? boredStdData : (boredStdData.results || []));
            setStartDate(projectData.start_date || "");
            setProjectName(projectData.title || projectData.name || "");

            // Safely fetch Run Rate (WorkCondition)
            try {
                const workCondResponse = await detailWorkCondition(projectId);
                console.log("[DEBUG LOAD] WorkCondition API response:", workCondResponse);

                const workCond = workCondResponse.data || workCondResponse;
                console.log("[DEBUG LOAD] WorkCondition data:", workCond);
                console.log("[DEBUG LOAD] earthwork_type:", workCond.earthwork_type);

                if (workCond && workCond.earthwork_type) {
                    const newWorkDayType = `${workCond.earthwork_type}d`;
                    console.log("[DEBUG LOAD] Setting workDayType to:", newWorkDayType);
                    setStoreWorkDayType(newWorkDayType);
                } else {
                    console.warn("[DEBUG LOAD] No earthwork_type found in response");
                }
            } catch (e) {
                console.warn("Run Rate Load Failed (Non-critical):", e);
            }
        } catch (error) {
            console.error("Data load failed:", error);
            toast.error("데이터 초기화 실패");
        } finally {
            setLoading(false);
        }
    }, [projectId, setStoreItems, setStoreOperatingRates, setStoreLinks, setStoreWorkDayType]);

    return {
        loading,
        loadData,
        cipResult,
        pileResult,
        boredResult,
        cipStandards,
        pileStandards,
        boredStandards,
        startDate,
        setStartDate,
        projectName,
        containerId,
        setContainerId
    };
};
