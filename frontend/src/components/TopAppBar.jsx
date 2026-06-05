import React from 'react';

const TopAppBar = () => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/70 dark:bg-surface-container/70 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-sm pt-safe">
      <div className="flex justify-between items-center w-full px-container-margin py-base max-w-7xl mx-auto h-16">
        <div className="flex items-center gap-stack-sm">
          <span className="material-symbols-outlined text-primary dark:text-on-primary text-headline-md">shield_with_heart</span>
          <span className="font-headline-md text-headline-md font-bold tracking-tight text-primary dark:text-on-primary">SafePulse</span>
        </div>
        <div className="flex items-center gap-stack-md">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/10">
            <img
              alt="User Profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD3jL-pQQn_SsQKQnAGy4Toc7NxRSxeqjcVs3ldD3J5BQVdtkW0xrATzPoprbEvODzGZfqJ557Dp8QLONAh7Dn2XQU5oeLxQyQ_UExvdfGTM9W-qKBP2TaQqiVpQnsdzEwbBTPve1j886XcjDbID-tUMbv6HxOZSkeJ2LX_APD8JQuB7ksixSu6XHVkt2dHtM_f-4f98SGyFjDbPX6MZxc7i1BrllNyTDGOzDTljpIIRIWBXNl1tHmoB-287ytjfNL7HHhcHELCObA"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopAppBar;
