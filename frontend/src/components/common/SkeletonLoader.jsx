import React from 'react';

export const TableSkeleton = ({ rows = 5, cols = 4 }) => {
    return (
        <div className="w-full bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
            <div className="flex justify-between items-center mb-6">
                <div className="h-6 w-1/4 bg-gray-200 rounded-lg"></div>
                <div className="h-10 w-1/3 bg-gray-200 rounded-xl"></div>
            </div>
            <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded-xl w-full"></div>
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="flex gap-4 items-center py-3 border-b border-gray-50">
                        {[...Array(cols)].map((_, j) => (
                            <div key={j} className="h-5 bg-gray-100/80 rounded-lg flex-1"></div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const CardSkeleton = () => {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 animate-pulse">
            <div className="flex items-center space-x-4">
                <div className="rounded-full bg-gray-200 h-12 w-12"></div>
                <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
            </div>
            <div className="h-20 bg-gray-100 rounded-xl w-full"></div>
        </div>
    );
};

export const DashboardSkeleton = () => {
    return (
        <div className="space-y-6 w-full p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <TableSkeleton rows={6} cols={5} />
                </div>
                <div className="space-y-6">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        </div>
    );
};
