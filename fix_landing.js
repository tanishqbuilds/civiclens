const fs = require('fs');
let content = fs.readFileSync('./client/src/pages/LandingPage.jsx', 'utf8');

// Container
content = content.replace('bg-[#050816] font-display text-white', 'bg-slate-50 font-display text-slate-900');

// Nav
content = content.replace('<nav className="relative z-50 w-full border-b border-white/5">', '<nav className="relative z-50 w-full border-b border-slate-200 bg-white/50 backdrop-blur-md">');
content = content.replace('text-slate-300', 'text-slate-600');
content = content.replace('hover:text-white', 'hover:text-indigo-600');
content = content.replace('bg-white/5', 'bg-slate-100');
content = content.replace('shadow-indigo-500/25', 'shadow-indigo-500/30');

// Logo Link to dashboard only
content = content.replace('<Link to="/" className="flex items-center gap-2.5 group">', '<Link to={isUserAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">');

// Badges
content = content.replace('bg-white/5 border border-white/10', 'bg-indigo-50 border border-indigo-100 text-indigo-700');
content = content.replace('text-slate-300 tracking-wider', 'text-indigo-700 tracking-wider');

// Hero Subtitle
content = content.replace('text-slate-400 mt-6', 'text-slate-600 mt-6');

// Grid Panels
let i = 0;
while(i < 10) {
    content = content.replace('bg-white/[0.03] border border-white/5', 'bg-white border border-slate-200 shadow-sm');
    content = content.replace('text-slate-400 leading-relaxed', 'text-slate-600 leading-relaxed');
    content = content.replace('text-[60px] font-black text-white/[0.04]', 'text-[60px] font-black text-slate-100');
    content = content.replace('bg-white/[0.06] hover:border-white/10', 'bg-white shadow-md border-slate-300');
    i++;
}

// Stats & Footer Links
while (content.includes('text-slate-500')) {
    content = content.replace('text-slate-500', 'text-slate-600');
}
content = content.replace('border-t border-white/5', 'border-t border-slate-200');
content = content.replace('border-b border-white/5', 'border-b border-slate-200');

// Hero Fix your city Text
content = content.replace('<span className="text-slate-300">Fix Your City</span>', '<span className="text-slate-800">Fix Your City</span>');

// Buttons / Links
content = content.replace('text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white', 'text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-indigo-600');
content = content.replace('text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white', 'text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-indigo-600');
content = content.replace('text-slate-300 hover:text-white hover:bg-white/5', 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100');

// Final fixes
content = content.replace('border-t border-white/5 py-10', 'border-t border-slate-200 py-10');

// Hero Card Mockup
content = content.replace('bg-white/[0.03] backdrop-blur-sm p-1', 'bg-white shadow-xl shadow-indigo-900/5 p-1');
content = content.replace('bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900', 'bg-white pb-6 pt-6 pl-10 pr-10 border border-slate-100');

// Ensure text that should be dark is replaced
content = content.replace("Civic<span className=\"text-indigo-400\">Lens</span>", "Civic<span className=\"text-indigo-600\">Lens</span>");

fs.writeFileSync('./client/src/pages/LandingPage.jsx', content);
