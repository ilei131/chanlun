import { useState, useEffect } from 'react';
import { Input, List, Card, Tag, Spin, Empty } from 'antd';
import { SearchOutlined, EnvironmentOutlined, BankOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { stockApi, SearchResult } from '@/api';
const { Search } = Input;
function StockSearch() {
 const [keyword, setKeyword] = useState('');
 const [results, setResults] = useState<SearchResult[]>([]);
 const [loading, setLoading] = useState(false);
 const navigate = useNavigate();
 const handleSearch = async (value: string) => {
 if (!value.trim()) {
 setResults([]);
 return;
 }
 setLoading(true);
 try {
 const response = await stockApi.search(value.trim());
 setResults(response.data);
 }
 catch (error) {
 console.error('搜索失败:', error);
 setResults([]);
 }
 finally {
 setLoading(false);
 }
 };
 const handleSelectStock = (code: string) => {
 navigate(`/stock/${code}`);
 };
 const getMarketLabel = (market: string) => {
 const labels: Record<string, {
 label: string;
 color: string;
 }> = {
 'SH': { label: '沪市', color: 'blue' },
 'SZ': { label: '深市', color: 'green' },
 'BJ': { label: '北交所', color: 'orange' },
 };
 return labels[market] || { label: market, color: 'gray' };
 };
 return (<div className="min-h-screen">
 <div className="mb-6">
 <Search placeholder="输入股票代码或名称搜索" allowClear enterButton={<SearchOutlined/>} size="large" onSearch={handleSearch} onChange={(e) => setKeyword(e.target.value)} style={{ width: '100%', maxWidth: 600 }} className="bg-slate-800/50 border border-white/10 rounded-lg"/>
 </div>

 {loading ? (<div className="flex justify-center items-center py-20">
 <Spin size="large"/>
 </div>) : results.length > 0 ? (<List grid={{ gutter: 16, column: 1 }} dataSource={results} renderItem={(item) => (<List.Item>
 <Card hoverable onClick={() => handleSelectStock(item.code)} className="bg-slate-800/50 border border-white/10 cursor-pointer hover:border-indigo-500/50 transition-colors">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div>
 <h3 className="text-lg font-semibold text-white">{item.name}</h3>
 <p className="text-gray-400 text-sm">{item.code}.{item.market}</p>
 </div>
 <Tag color={getMarketLabel(item.market).color}>
 {getMarketLabel(item.market).label}
 </Tag>
 </div>
 <div className="text-right">
 {item.industry && (<div className="flex items-center gap-1 text-gray-400 text-sm mb-1">
 <BankOutlined className="text-xs"/>
 <span>{item.industry}</span>
 </div>)}
 {item.area && (<div className="flex items-center gap-1 text-gray-400 text-sm">
 <EnvironmentOutlined className="text-xs"/>
 <span>{item.area}</span>
 </div>)}
 </div>
 </div>
 </Card>
 </List.Item>)} style={{ maxWidth: 800 }}/>) : keyword && (<Empty description="未找到匹配的股票"/>)}

 {!keyword && (<div className="text-center py-20">
 <SearchOutlined className="text-6xl text-gray-600 mb-4"/>
 <p className="text-gray-400">输入股票代码或名称开始搜索</p>
 </div>)}
 </div>);
}
export default StockSearch;

