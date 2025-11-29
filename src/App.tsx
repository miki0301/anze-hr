import { useState, useEffect, type FormEvent } from 'react';
import { 
  Users, 
  ClipboardList, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Info,
  ShieldAlert,
  Stethoscope,
  Briefcase,
  Filter,       // 新增圖示
  XCircle       // 新增圖示
} from 'lucide-react';

// --- Type Definitions ---

interface Task {
  id: string;
  title: string;
  desc: string;
  critical: boolean;
  risk: string;
  status: 'pending' | 'completed';
  completedDate: string | null;
}

interface Employee {
  id: string;
  name: string;
  startDate: string;
  type: string;
  role: string;
  roleNote: string;
  displayRole: string;
  status: 'active' | 'resigned';
  tasks: Task[];
}

interface EmpTypeConfig {
  id: string;
  label: string;
  color: string;
}

interface JobRoleConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

// --- 資料定義 ---

const EMP_TYPES: EmpTypeConfig[] = [
  { id: 'fulltime', label: '專任 (全職)', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'parttime', label: '兼職 (部分工時)', color: 'bg-orange-100 text-orange-700' }
];

const JOB_ROLES: JobRoleConfig[] = [
  { id: 'doctor', label: '醫師', icon: Stethoscope },
  { id: 'nurse', label: '護理師', icon: Users },
  { id: 'psychologist', label: '心理師', icon: Users },
  { id: 'therapist', label: '職能/物理治療師', icon: Users },
  { id: 'other', label: '其他人員 (行政/清潔等)', icon: Briefcase }
];

// --- 法規檢核資料庫 ---

const getChecklist = (type: string, role: string): Task[] => {
  const baseList: Partial<Task>[] = [
    { 
      id: 'ob-1', 
      title: '收取基本資料', 
      desc: '身分證、執業執照影本(醫事人員必備)、薪轉存摺。', 
      critical: false,
      risk: '資料不全'
    },
    { 
      id: 'ob-3', 
      title: '勞健保/勞退加保', 
      desc: '務必於「到職當日」申報。', 
      critical: true,
      risk: '勞保局罰款保費4-10倍'
    },
    { 
      id: 'ob-5', 
      title: '建立出勤紀錄', 
      desc: '需記錄至「分鐘」。即使是責任制(經核定)也需記錄。', 
      critical: true,
      risk: '罰款 9-45 萬'
    }
  ];

  if (type === 'parttime') {
    baseList.push({
      id: 'pt-1',
      title: '兼職薪資與國定假日確認',
      desc: '確認時薪不低於基本工資。國定假日出勤需給「雙倍」薪資。',
      critical: true,
      risk: '違反工資給付規定'
    });
    baseList.push({
      id: 'pt-2',
      title: '部分工時特休計算',
      desc: '依工時比例計算特休天數，非直接比照全職。',
      critical: false,
      risk: '特休給付不足'
    });
  } else {
    baseList.push({
      id: 'ft-1',
      title: '簽署勞動契約 (不定期)',
      desc: '確認為不定期契約，約定月薪結構。',
      critical: true,
      risk: '契約爭議'
    });
  }

  if (role === 'doctor') {
    baseList.push({
      id: 'doc-1',
      title: '醫師契約性質確認',
      desc: '確認是「僱傭」(適用勞基法)或「委任」(駐診拆帳)。若為僱傭仍需投保勞工保險(自願投保)或就業保險。',
      critical: true,
      risk: '身分認定爭議'
    });
    baseList.push({
      id: 'doc-2',
      title: '衛生局執業登記 (支援報備)',
      desc: '確認醫師執照已辦理執業登記或支援報備。',
      critical: true,
      risk: '違反醫療法'
    });
  } else {
    baseList.push({
        id: 'med-1',
        title: '醫事人員執業登記',
        desc: '確認執照已登錄於本機構。',
        critical: true,
        risk: '違反醫事法規'
    });
  }

  return baseList.map(item => ({ 
    id: item.id!, 
    title: item.title!, 
    desc: item.desc!, 
    critical: item.critical!, 
    risk: item.risk!, 
    status: 'pending', 
    completedDate: null 
  }));
};

// --- 元件 ---

const Card = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-lg shadow-sm border border-slate-200 ${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
  >
    {children}
  </div>
);

const Badge = ({ color, text }: { color?: string, text?: string }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-medium border border-transparent ${color || 'bg-gray-100 text-gray-600'}`}>
    {text}
  </span>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  // 新增：篩選狀態 ('all' | 'risk' | 'parttime')
  const [filterType, setFilterType] = useState<'all' | 'risk' | 'parttime'>('all');
  
  const [isOtherRole, setIsOtherRole] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('micro_clinic_hr');
    if (saved) {
      try {
        setEmployees(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load data", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('micro_clinic_hr', JSON.stringify(employees));
  }, [employees]);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || null;

  // 計算篩選後的清單
  const filteredEmployees = employees.filter(emp => {
    if (filterType === 'all') return true;
    if (filterType === 'parttime') return emp.type === 'parttime';
    if (filterType === 'risk') {
        // 篩選有「未完成」「重要」任務的人
        return emp.tasks.some(t => t.critical && t.status === 'pending');
    }
    return true;
  });

  const handleAddEmployee = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const role = formData.get('role') as string;
    const type = formData.get('type') as string;
    const name = formData.get('name') as string;
    const startDate = formData.get('startDate') as string;
    const roleNote = formData.get('otherRoleNote') as string;

    let displayRole = JOB_ROLES.find(r => r.id === role)?.label || '';
    if (role === 'other') {
        displayRole = roleNote || '其他人員';
    }

    const newEmployee: Employee = {
      id: Date.now().toString(),
      name: name,
      startDate: startDate,
      type: type,
      role: role,
      roleNote: roleNote,
      displayRole: displayRole,
      status: 'active',
      tasks: getChecklist(type, role)
    };

    setEmployees([...employees, newEmployee]);
    setShowAddModal(false);
    setIsOtherRole(false);
    // 新增後自動切換到全列表並顯示該員工
    setFilterType('all');
  };

  const toggleTask = (empId: string, taskId: string) => {
    setEmployees(employees.map(emp => {
      if (emp.id !== empId) return emp;
      return {
        ...emp,
        tasks: emp.tasks.map(t => {
          if (t.id !== taskId) return t;
          const newStatus = t.status === 'pending' ? 'completed' : 'pending';
          return { 
            ...t, 
            status: newStatus,
            completedDate: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : null
          };
        })
      };
    }));
  };

  const deleteEmployee = (id: string) => {
    if(confirm('確定要刪除資料嗎？')) {
      setEmployees(employees.filter(e => e.id !== id));
      if (selectedEmployeeId === id) setSelectedEmployeeId(null);
    }
  };

  const stats = {
    total: employees.length,
    pendingCritical: employees.reduce((acc, emp) => acc + emp.tasks.filter(t => t.critical && t.status === 'pending').length, 0),
    partTime: employees.filter(e => e.type === 'parttime').length
  };

  // 導航到列表並篩選的輔助函式
  const navigateToList = (filter: 'all' | 'risk' | 'parttime') => {
    setFilterType(filter);
    setActiveTab('employees');
    setSelectedEmployeeId(null); // 回到列表頁
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-teal-600" />
          <h1 className="text-lg font-bold text-slate-800">安澤健康-人資守門員</h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增人員
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Sidebar */}
        <div className="md:col-span-3 space-y-2">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedEmployeeId(null); }}
            className={`w-full text-left px-4 py-2 rounded-md flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-600 hover:bg-white'}`}
          >
            <ClipboardList className="w-4 h-4" /> 總覽儀表板
          </button>
          <button 
            onClick={() => navigateToList('all')}
            className={`w-full text-left px-4 py-2 rounded-md flex items-center gap-2 ${activeTab === 'employees' ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-600 hover:bg-white'}`}
          >
            <Users className="w-4 h-4" /> 人員名單
          </button>
        </div>

        {/* Content */}
        <div className="md:col-span-9">
          
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 讓卡片可以點擊，並加入 onClick 事件 */}
                <Card onClick={() => navigateToList('all')} className="p-4 border-l-4 border-l-teal-500">
                  <div className="flex justify-between items-start">
                    <div>
                        <div className="text-slate-500 text-xs uppercase tracking-wide font-semibold">在職總數</div>
                        <div className="text-2xl font-bold mt-1">{stats.total}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </Card>

                <Card onClick={() => navigateToList('risk')} className="p-4 border-l-4 border-l-red-500">
                  <div className="flex justify-between items-start">
                    <div>
                        <div className="text-slate-500 text-xs uppercase tracking-wide font-semibold">法規風險未完成</div>
                        <div className="text-2xl font-bold mt-1 text-red-600">{stats.pendingCritical} <span className="text-sm font-normal text-slate-400">項</span></div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </Card>

                <Card onClick={() => navigateToList('parttime')} className="p-4 border-l-4 border-l-orange-500">
                  <div className="flex justify-between items-start">
                    <div>
                        <div className="text-slate-500 text-xs uppercase tracking-wide font-semibold">兼職人員</div>
                        <div className="text-2xl font-bold mt-1">{stats.partTime} <span className="text-sm font-normal text-slate-400">人</span></div>
                        <div className="text-xs text-orange-600 mt-1">留意國定假日雙倍薪</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </Card>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  待辦事項提醒
                </h3>
                {employees.flatMap(e => e.tasks.filter(t => t.status === 'pending' && t.critical).map(t => ({...t, empName: e.name, empId: e.id, type: e.type}))).length === 0 ? (
                   <div className="text-center py-8 bg-white rounded-lg border border-dashed border-slate-300 text-slate-500">
                    目前合規狀況良好 🎉
                  </div>
                ) : (
                  <div className="space-y-3">
                     {employees.flatMap(e => e.tasks.filter(t => t.status === 'pending' && t.critical).map(t => ({...t, empName: e.name, empId: e.id, type: e.type})))
                      .map((task) => (
                        <div key={`${task.empId}-${task.id}`} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-slate-700">{task.empName}</span>
                              {task.type === 'parttime' && <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">兼職</span>}
                            </div>
                            <div className="font-medium text-sm">{task.title}</div>
                            <div className="text-xs text-red-500 mt-1">⚠️ {task.risk}</div>
                          </div>
                          <button 
                            onClick={() => { 
                              setSelectedEmployeeId(task.empId);
                              setActiveTab('employees'); 
                            }}
                            className="text-teal-600 text-sm font-medium hover:underline mt-1"
                          >
                             處理
                          </button>
                        </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Employee List */}
          {activeTab === 'employees' && !selectedEmployee && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    {filterType === 'all' && '人員名單'}
                    {filterType === 'risk' && <span className="text-red-600 flex items-center gap-2"><Filter className="w-4 h-4"/> 待處理法規風險人員</span>}
                    {filterType === 'parttime' && <span className="text-orange-600 flex items-center gap-2"><Filter className="w-4 h-4"/> 兼職人員名單</span>}
                  </h2>
                  
                  {/* 顯示清除篩選按鈕 */}
                  {filterType !== 'all' && (
                    <button 
                        onClick={() => setFilterType('all')}
                        className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded"
                    >
                        <XCircle className="w-4 h-4" /> 顯示全部
                    </button>
                  )}
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-300">
                  <p className="text-slate-500">
                    {filterType === 'all' ? '尚無人員資料' : '沒有符合篩選條件的人員'}
                  </p>
                  {filterType !== 'all' && (
                      <button onClick={() => setFilterType('all')} className="mt-2 text-teal-600 hover:underline">查看所有人員</button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredEmployees.map(emp => {
                    const criticalCount = emp.tasks.filter(t => t.status === 'pending' && t.critical).length;
                    const typeConfig = EMP_TYPES.find(t => t.id === emp.type);
                    
                    return (
                      <Card key={emp.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                        <div onClick={() => setSelectedEmployeeId(emp.id)} className="flex-1 w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-lg">{emp.name}</h3>
                            <Badge color={typeConfig?.color} text={typeConfig?.label} />
                            <Badge color="bg-slate-100 text-slate-600" text={emp.displayRole} />
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                             到職日: {emp.startDate}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                          {criticalCount > 0 ? (
                            <div className="text-red-600 text-sm font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {criticalCount} 項未完成
                            </div>
                          ) : (
                            <div className="text-green-600 text-sm font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              合規
                            </div>
                          )}
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Employee Details */}
          {activeTab === 'employees' && selectedEmployee && (
            <div>
              <button 
                onClick={() => setSelectedEmployeeId(null)}
                className="mb-4 text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                ← 返回名單
              </button>

              <div className="bg-white rounded-t-lg border border-slate-200 p-6 pb-6 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        {selectedEmployee.name}
                        {selectedEmployee.role === 'doctor' && <Stethoscope className="w-5 h-5 text-teal-600" />}
                    </h1>
                    <div className="flex gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedEmployee.type === 'parttime' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {EMP_TYPES.find(t => t.id === selectedEmployee.type)?.label}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-bold">
                            {selectedEmployee.displayRole}
                        </span>
                    </div>
                  </div>
                  <button onClick={() => deleteEmployee(selectedEmployee.id)} className="text-red-400 hover:text-red-600 p-2">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-b-lg border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
                  專屬法規檢核表
                </h3>
                
                {selectedEmployee.tasks.map(task => (
                  <div key={task.id} className={`bg-white p-4 rounded-lg border ${task.status === 'completed' ? 'opacity-75' : task.critical ? 'border-l-4 border-l-red-500 border-red-100' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => toggleTask(selectedEmployee.id, task.id)}
                        className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}
                      >
                        {task.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`font-medium ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {task.title}
                          </span>
                          {task.critical && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded border border-red-200">必辦</span>}
                        </div>
                        <p className="text-sm text-slate-600 mb-1">{task.desc}</p>
                        {task.status !== 'completed' && task.critical && (
                           <div className="text-xs text-red-500 font-medium">⚠️ 風險：{task.risk}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">新增人員資料</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                <input 
                  required 
                  name="name" 
                  type="text" 
                  autoComplete="off"
                  className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:border-teal-500" 
                  placeholder="例如：林小美" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">到職日期</label>
                <input required name="startDate" type="date" className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:border-teal-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">聘僱類型</label>
                <div className="grid grid-cols-2 gap-3">
                  {EMP_TYPES.map(type => (
                    <label key={type.id} className="cursor-pointer">
                      <input type="radio" name="type" value={type.id} className="peer sr-only" required defaultChecked={type.id === 'fulltime'} />
                      <div className="border border-slate-200 rounded-md p-2 text-center text-sm peer-checked:bg-teal-50 peer-checked:border-teal-500 peer-checked:text-teal-700 transition-all">
                          {type.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">專業職務</label>
                <select 
                    required 
                    name="role" 
                    defaultValue=""
                    className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:border-teal-500 bg-white"
                    onChange={(e) => {
                        setIsOtherRole(e.target.value === 'other');
                    }}
                >
                  <option value="" disabled>請選擇職務</option> 
                  {JOB_ROLES.map(role => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
              </div>

              {isOtherRole && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">請註明職務名稱</label>
                  <input 
                    required 
                    name="otherRoleNote" 
                    type="text" 
                    className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:border-teal-500" 
                    placeholder="例如：行政櫃台、清潔人員" 
                  />
                </div>
              )}

              <div className="bg-teal-50 p-3 rounded text-sm text-teal-800 flex gap-2">
                <Info className="w-5 h-5 flex-shrink-0" />
                <span className="text-xs">
                  系統將根據「職務」與「聘僱類型」自動生成專屬的法規檢核清單（包含醫事人員報備、兼職薪資計算等）。
                </span>
              </div>

              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50">取消</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">確認新增</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
