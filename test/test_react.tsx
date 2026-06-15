import { format } from 'date-fns';
import NotificationCard from './NotificationCard';
import EmptyState from './EmptyState';

function typeTone(type: string) {
    return type;
}

export function NotificationFeed({ items }: { items: unknown[] }) {
    if (!items.length) return <EmptyState />;
    return (
        <div>
            {items.map((item) => (
                <NotificationCard key={(item as { id: string }).id} item={item} />
            ))}
        </div>
    );
}
