import { useState } from 'react';
import { Spin, Empty } from 'antd';
import { SearchOutlined, BuildOutlined, EnvironmentOutlined, ApiOutlined, ArrowUpOutlined, DatabaseOutlined, TagOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { stockApi, Stock } from '@/api';

function StockSearch() {
    const [keyword, setKeyword] = useState('');
    const [results, setResults] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const hotStocks = ['600519', '000858', '601318', '000001', '600036'];

    const handleSearch = async (value: string) => {
        if (!value.trim()) {
            setResults([]);
            return;
        }
        const trimmedValue = value.trim();
        if (/^\d{6}$/.test(trimmedValue)) {
            navigate(`/stock/${trimmedValue}`);
            return;
        }
        setLoading(true);
        try {
            const response = await stockApi.search(trimmedValue);
            if (response.data) {
                if (response.data.length === 1) {
                    navigate(`/stock/${response.data[0].code}`);
                } else {
                    setResults(response.data);
                }
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error('搜索失败:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStock = (code: string) => {
        navigate(`/stock/${code}`);
    };

    const getMarketLabel = (market: string) => {
        const labels: Record<string, { label: string; color: string; bgColor: string }> = {
            'SH': { label: '沪市', color: '#60a5fa', bgColor: 'rgba(59, 130, 246, 0.15)' },
            'SZ': { label: '深市', color: '#34d399', bgColor: 'rgba(16, 185, 129, 0.15)' },
            'BJ': { label: '北交所', color: '#fb923c', bgColor: 'rgba(249, 115, 22, 0.15)' },
        };
        return labels[market] || { label: market, color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)' };
    };

    const stats = [
        { icon: <DatabaseOutlined className="w-6 h-6" />, value: '5000+', label: '股票覆盖', color: '#646cff' },
        { icon: <ArrowUpOutlined className="w-6 h-6" />, value: '实时', label: '行情数据', color: '#10b981' },
        { icon: <ApiOutlined className="w-6 h-6" />, value: 'AI', label: '智能分析', color: '#f59e0b' },
        { icon: <TagOutlined className="w-6 h-6" />, value: '缠论', label: '专业策略', color: '#8b5cf6' },
    ];

    return (
        <div style={{
            minHeight: '100%',
            padding: '40px 20px',
            boxSizing: 'border-box'
        }}>
            {/* Hero Section */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    background: 'rgba(100, 108, 255, 0.15)',
                    border: '1px solid rgba(100, 108, 255, 0.3)',
                    marginBottom: '20px'
                }}>
                    <ApiOutlined style={{ color: '#646cff' }} className="w-4 h-4" />
                    <span style={{ color: '#a1a8b8', fontSize: '13px' }}>智能选股，精准分析</span>
                </div>

                <h1 style={{
                    fontSize: '36px',
                    fontWeight: 'bold',
                    marginBottom: '12px',
                    background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 50%, #c7d2fe 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 30px rgba(100, 108, 255, 0.3)'
                }}>
                    缠论选股系统
                </h1>
                <p style={{
                    color: '#a1a8b8',
                    maxWidth: '400px',
                    margin: '0 auto',
                    fontSize: '14px',
                    lineHeight: '1.6'
                }}>
                    基于缠论理论，结合量化分析，为您提供精准的股票买卖信号
                </p>
            </div>

            {/* Search Bar */}
            <div style={{ maxWidth: '600px', margin: '0 auto 40px' }}>
                <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '16px',
                    overflow: 'hidden'
                }}>
                    <input
                        type="text"
                        placeholder="输入股票代码或名称搜索"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch(keyword)}
                        className="search-input"
                        style={{
                            flex: 1,
                            padding: '16px 20px',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#ffffff',
                            fontSize: '16px'
                        }}
                    />
                    <button
                        onClick={() => handleSearch(keyword)}
                        style={{
                            width: '56px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #646cff 0%, #8b5cf6 100%)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.25s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(100, 108, 255, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <SearchOutlined style={{ color: '#fff' }} className="w-5 h-5" />
                    </button>
                </div>

                {/* Hot Stocks */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '16px'
                }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>热门股票:</span>
                    {hotStocks.map((code) => (
                        <button
                            key={code}
                            onClick={() => navigate(`/stock/${code}`)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '20px',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(100, 108, 255, 0.2)',
                                color: '#a1a8b8',
                                cursor: 'pointer',
                                transition: 'all 0.25s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.borderColor = 'rgba(100, 108, 255, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = 'rgba(100, 108, 255, 0.2)';
                            }}
                        >
                            {code}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Cards */}
            {!keyword && !loading && !results.length && (
                <div style={{ maxWidth: '800px', margin: '0 auto 40px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '16px'
                    }}>
                        {stats.map((stat, index) => (
                            <div
                                key={index}
                                style={{
                                    background: 'rgba(20, 20, 35, 0.9)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(100, 108, 255, 0.2)',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: `${stat.color}20`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <span style={{ color: stat.color }}>{stat.icon}</span>
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: '24px',
                                            fontWeight: 'bold',
                                            color: stat.color
                                        }}>
                                            {stat.value}
                                        </div>
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#6b7280'
                                        }}>
                                            {stat.label}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search Results */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px' }}>
                    <Spin size="large" tip="搜索中..." />
                </div>
            ) : results.length > 0 ? (
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '16px',
                        paddingLeft: '8px'
                    }}>
                        <SearchOutlined style={{ color: '#646cff' }} className="w-4 h-4" />
                        <span style={{ color: '#a1a8b8', fontSize: '14px' }}>
                            找到 {results.length} 只股票
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {results.map((item) => {
                            const marketInfo = getMarketLabel(item.market);
                            return (
                                <div
                                    key={item.code}
                                    onClick={() => handleSelectStock(item.code)}
                                    style={{
                                        background: 'rgba(20, 20, 35, 0.9)',
                                        backdropFilter: 'blur(20px)',
                                        border: '1px solid rgba(100, 108, 255, 0.2)',
                                        borderRadius: '16px',
                                        padding: '20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(100, 108, 255, 0.5)';
                                        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(100, 108, 255, 0.2)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <div
                                                    style={{
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '12px',
                                                        background: `linear-gradient(135deg, ${marketInfo.color}20 0%, ${marketInfo.color}10 100%)`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '18px',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {item.name.charAt(0)}
                                                </div>
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '-4px',
                                                        right: '-4px',
                                                        width: '16px',
                                                        height: '16px',
                                                        borderRadius: '50%',
                                                        background: marketInfo.color,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        color: '#fff'
                                                    }}
                                                >
                                                    {marketInfo.label.charAt(0)}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 style={{
                                                    fontSize: '16px',
                                                    fontWeight: '600',
                                                    color: '#ffffff',
                                                    marginBottom: '4px'
                                                }}>
                                                    {item.name}
                                                </h3>
                                                <p style={{
                                                    fontSize: '13px',
                                                    fontFamily: 'monospace',
                                                    color: '#6b7280'
                                                }}>
                                                    {item.code}.{item.market}
                                                </p>
                                            </div>
                                            <span
                                                style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '6px',
                                                    background: marketInfo.bgColor,
                                                    color: marketInfo.color,
                                                    border: `1px solid ${marketInfo.color}30`,
                                                    fontSize: '12px',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                {marketInfo.label}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {item.industry && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: '#a1a8b8',
                                                    fontSize: '13px',
                                                    marginBottom: '4px'
                                                }}>
                                                    <BuildOutlined className="w-3.5 h-3.5" />
                                                    <span>{item.industry}</span>
                                                </div>
                                            )}
                                            {item.area && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: '#a1a8b8',
                                                    fontSize: '13px'
                                                }}>
                                                    <EnvironmentOutlined className="w-3.5 h-3.5" />
                                                    <span>{item.area}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : keyword && !loading ? (
                <div style={{ textAlign: 'center', padding: '80px' }}>
                    <Empty description="未找到匹配的股票" />
                </div>
            ) : null}
        </div>
    );
}

export default StockSearch;
