import React from "react";

export default function PageHeader({ title, description }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold">
        {title}
        {description && (
          <span className="text-gray-400 text-sm ml-2">{description}</span>
        )}
      </h1>
    </div>
  );
}
