import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import ConfirmModal from "../components/common/ConfirmModal";

const ConfirmContext = createContext({
    confirm: async () => false,
    alert: async () => undefined
});

export function ConfirmProvider({ children }) {
    const [modal, setModal] = useState(null);
    const resolverRef = useRef(null);

    const openModal = useCallback((options) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setModal({
                title: options.title || "확인",
                message: options.message || "",
                confirmText: options.confirmText || "확인",
                cancelText: options.cancelText || "취소",
                showCancel: options.showCancel !== false
            });
        });
    }, []);

    const confirm = useCallback((message, options = {}) => {
        if (typeof message === "string") {
            return openModal({ ...options, message, showCancel: true });
        }
        return openModal({ ...message, showCancel: true });
    }, [openModal]);

    const alert = useCallback((message, options = {}) => {
        if (typeof message === "string") {
            return openModal({ ...options, message, showCancel: false });
        }
        return openModal({ ...message, showCancel: false });
    }, [openModal]);

    const handleConfirm = useCallback(() => {
        if (resolverRef.current) resolverRef.current(true);
        resolverRef.current = null;
        setModal(null);
    }, []);

    const handleCancel = useCallback(() => {
        if (resolverRef.current) resolverRef.current(false);
        resolverRef.current = null;
        setModal(null);
    }, []);

    const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

    return (
        <ConfirmContext.Provider value={value}>
            {children}
            <ConfirmModal
                isOpen={!!modal}
                title={modal?.title}
                message={modal?.message}
                confirmText={modal?.confirmText}
                cancelText={modal?.cancelText}
                showCancel={modal?.showCancel}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    return useContext(ConfirmContext);
}
